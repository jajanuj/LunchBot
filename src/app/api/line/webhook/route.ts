// LINE Webhook 接收端點。
// 設定方式：StockBot channel 的 Messaging API 分頁 -> Webhook URL 填
// `https://你的網域/api/line/webhook`（本機開發用 ngrok 等工具建立臨時網址）。
import { NextResponse } from "next/server";
import type { webhook } from "@line/bot-sdk";
import { isValidLineSignature } from "@/lib/line/webhook";

export async function POST(request: Request) {
  const signature = request.headers.get("x-line-signature");
  // 必須讀取「原始」body 字串做簽章驗證，不能先 JSON.parse 再序列化回去
  const rawBody = await request.text();

  let isValid: boolean;
  try {
    isValid = isValidLineSignature(rawBody, signature);
  } catch (err) {
    console.error("[line webhook] 簽章驗證設定錯誤：", err);
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  if (!isValid) {
    console.warn("[line webhook] 簽章驗證失敗，拒絕請求");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: webhook.CallbackRequest;
  try {
    payload = JSON.parse(rawBody) as webhook.CallbackRequest;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  for (const event of payload.events ?? []) {
    // 先把所有事件完整記錄下來，方便之後從 log 找 LINE_GROUP_ID、
    // 確認實際收到的事件格式跟官方文件是否一致
    console.log("[line webhook] event:", JSON.stringify(event));

    if (event.source?.type === "group") {
      console.log(
        `[line webhook] 偵測到群組事件，groupId = ${event.source.groupId}` +
          "（這就是要存進 .env.local 的 LINE_GROUP_ID）"
      );
    }
  }

  return NextResponse.json({ status: "ok" });
}

// 方便用瀏覽器直接訪問來確認這個路由活著，不做任何驗證
export async function GET() {
  return NextResponse.json({ status: "line webhook is alive" });
}
