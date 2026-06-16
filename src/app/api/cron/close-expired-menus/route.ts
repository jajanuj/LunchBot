// 排程端點：把過了截止時間還在「收單中」的菜單自動關閉。
// 對應計劃文件流程三第一步。部署到 Vercel 後，由 vercel.json 設定的
// Cron Job 定時呼叫這個路徑（見專案根目錄 vercel.json）。
//
// 安全性：用 CRON_SECRET 當簡單的驗證，避免這個會異動資料的端點被外部
// 隨意呼叫。Vercel Cron 觸發時會自動帶上 `Authorization: Bearer
// ${CRON_SECRET}`（讀取同名環境變數），本機/手動測試也要帶一樣的值。
import { NextResponse } from "next/server";
import { closeExpiredMenus } from "@/lib/data/menus";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron close-expired-menus] 環境變數 CRON_SECRET 未設定");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const closed = await closeExpiredMenus();
  if (closed.length > 0) {
    console.log(
      `[cron close-expired-menus] 自動關閉 ${closed.length} 張菜單：`,
      closed.map((m) => `${m.menuDate} ${m.storeName}`).join("、")
    );
  }

  return NextResponse.json({ status: "ok", closedCount: closed.length, closed });
}
