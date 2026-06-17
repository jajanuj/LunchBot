import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase.ts";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { createMenuAiImport } from "@/lib/data/menuAiImports";

const BUCKET = "menu-images";
const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ALLOWED_TYPES,
    fileSizeLimit: MAX_FILE_SIZE,
  });
  // 忽略 "already exists" 錯誤
  if (error && !error.message.toLowerCase().includes("already exist")) {
    console.error("[parse-menu] 建立 Storage bucket 失敗：", error.message);
  }
}

export async function POST(request: Request) {
  // 驗證 session（Route Handler 無法用 verifySession() 的 redirect 流程，改手動驗證）
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY 未設定，請在 .env.local 加入" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "請求格式錯誤" }, { status: 400 });
  }

  const imageFile = formData.get("image") as File | null;
  if (!imageFile || imageFile.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳圖片" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(imageFile.type)) {
    return NextResponse.json(
      { ok: false, error: "僅支援 JPG / PNG / GIF / WebP 格式" },
      { status: 400 }
    );
  }
  if (imageFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { ok: false, error: "圖片大小不可超過 10MB" },
      { status: 400 }
    );
  }

  const arrayBuffer = await imageFile.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = Buffer.from(bytes).toString("base64");

  // 上傳原圖至 Supabase Storage（留存供事後追溯）
  let imagePath = `pending/${Date.now()}_${imageFile.name}`;
  try {
    await ensureBucket();
    const ext = imageFile.name.split(".").pop() ?? "jpg";
    const fileName = `${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, bytes, { contentType: imageFile.type });
    if (!uploadErr) {
      imagePath = `${BUCKET}/${fileName}`;
    } else {
      console.error("[parse-menu] Storage upload error:", uploadErr.message);
    }
  } catch (e) {
    console.error("[parse-menu] Storage error:", e);
  }

  // 呼叫 Gemini Vision API（REST，不依賴額外 npm 套件）
  const prompt = `請仔細分析這張菜單圖片，提取所有餐點或飲料品項與對應價格。
以 JSON 格式回傳（只回傳純 JSON，不要加任何說明文字或 markdown 標記）：
{
  "storeName": "店家名稱（圖片中若有明確顯示則填入，否則填 null）",
  "items": [
    { "itemName": "品項名稱", "price": 數字 }
  ]
}
規則：
- 價格填整數；若圖片未標示價格，price 填 0。
- 若品項有多個尺寸或規格（如 M/L、中/大、小/中/大），每個尺寸分別列為獨立一筆，品名後面加上尺寸標記。例如「奶茶 M 40元、L 55元」→ 列兩筆：{"itemName":"奶茶(M)","price":40} 與 {"itemName":"奶茶(L)","price":55}。
- 所有欄位、所有分類的品項都要完整列出，不可省略。
- 若圖片中完全看不到可辨識的菜單資訊，回傳 { "storeName": null, "items": [] }。`;

  let rawResponse: unknown;
  let extractedItems: { itemName: string; price: number }[] = [];
  let extractedStoreName: string | null = null;

  // 呼叫 Gemini，遇到 429 Rate Limit 最多重試 3 次（間隔 3 秒）
  const geminiBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: imageFile.type, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  });

  try {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: geminiBody }
      );
      if (res.status !== 429 && res.status !== 503) break;
      console.warn(`[parse-menu] Gemini ${res.status}，第 ${attempt + 1} 次重試...`);
    }

    if (!res!.ok) {
      const errText = await res!.text();
      console.error("[parse-menu] Gemini API error:", res!.status, errText);
      return NextResponse.json(
        {
          ok: false,
          error: `AI 辨識 API 呼叫失敗（HTTP ${res!.status}），請稍後重試或改用手動輸入`,
        },
        { status: 502 }
      );
    }

    rawResponse = await res!.json();
    const text =
      (
        rawResponse as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        }
      )?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // 擷取 JSON（Gemini 偶爾會在 JSON 外加 markdown code block）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        storeName?: string | null;
        items?: { itemName: string; price: number }[];
      };
      extractedItems = Array.isArray(parsed.items) ? parsed.items : [];
      extractedStoreName = parsed.storeName ?? null;
    }
  } catch (err) {
    console.error("[parse-menu] Gemini 呼叫失敗：", err);
    return NextResponse.json(
      { ok: false, error: "AI 辨識發生錯誤，請重試或改用手動輸入" },
      { status: 500 }
    );
  }

  // 儲存 AI 辨識原始結果（無論是否辨識成功都留存，供事後比對）
  let importId: string | null = null;
  try {
    importId = await createMenuAiImport({
      storeName: extractedStoreName ?? "未知店家",
      imagePath,
      rawResponse: rawResponse ?? {},
    });
  } catch (e) {
    console.error("[parse-menu] 儲存 menu_ai_imports 失敗：", e);
  }

  if (extractedItems.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "AI 無法從這張圖片辨識出菜單品項，請重新上傳更清晰的圖片，或改用手動輸入",
        importId,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    ok: true,
    items: extractedItems,
    storeName: extractedStoreName,
    importId,
  });
}
