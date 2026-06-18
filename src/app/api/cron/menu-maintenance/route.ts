// 排程端點：菜單維護（對應計劃文件流程三）。
// 1. 截止前提醒：找出設定了 reminder_minutes_before、還沒發過提醒、
//    且已經進入提醒區間的菜單，推播一則文字訊息提醒，並標記已發送。
// 2. 自動結單：把過了截止時間還在「收單中」的菜單關閉。
//
// 部署到 Vercel 後，由 vercel.json 設定的 Cron Job 定時呼叫這個路徑。
// 安全性：用 CRON_SECRET 驗證（Authorization: Bearer ${CRON_SECRET}），
// 避免這個會異動資料、會發 LINE 訊息的端點被外部隨意呼叫。
import { NextResponse } from "next/server";
import { closeExpiredMenus, findMenusDueForReminder, markReminderSent } from "@/lib/data/menus";
import { listOrdersByMenu } from "@/lib/data/orders";
import { buildReminderText } from "@/lib/line/flexMessage";
import { getLineMessagingClient } from "@/lib/line/client";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron menu-maintenance] 環境變數 CRON_SECRET 未設定");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1. 截止前提醒
  const remindersSent: string[] = [];
  const dueMenus = await findMenusDueForReminder(now);
  if (dueMenus.length > 0) {
    const groupId = process.env.LINE_GROUP_ID;
    if (!groupId) {
      console.error("[cron menu-maintenance] 環境變數 LINE_GROUP_ID 未設定，無法發送提醒");
    } else {
      const client = getLineMessagingClient();
      for (const menu of dueMenus) {
        try {
          await client.pushMessage({
            to: groupId,
            messages: [{ type: "text", text: buildReminderText(menu) }],
          });
          await markReminderSent(menu.id, now);
          remindersSent.push(`${menu.menuDate} ${menu.storeName}`);
        } catch (err) {
          console.error(`[cron menu-maintenance] 推播提醒失敗（${menu.storeName}）：`, err);
        }
      }
    }
  }

  // 2. 自動結單
  const closed = await closeExpiredMenus(now);

  // 3. 結單後推播叫貨清單
  const summariesPushed: string[] = [];
  if (closed.length > 0) {
    const groupId = process.env.LINE_GROUP_ID;
    if (!groupId) {
      console.error("[cron menu-maintenance] 環境變數 LINE_GROUP_ID 未設定，無法推播叫貨清單");
    } else {
      const client = getLineMessagingClient();
      for (const menu of closed) {
        try {
          const orders = await listOrdersByMenu(menu.id);
          const pendingOrders = orders.filter((o) => o.status === "pending");
          if (pendingOrders.length === 0) continue;

          const itemQtyMap = new Map<string, { itemName: string; price: number; qty: number }>();
          for (const order of pendingOrders) {
            for (const item of order.items) {
              const cur = itemQtyMap.get(item.menuItemId) ?? { itemName: item.itemName, price: item.price, qty: 0 };
              cur.qty += item.quantity;
              itemQtyMap.set(item.menuItemId, cur);
            }
          }

          let totalQty = 0;
          let totalAmt = 0;
          const lines = [`【叫貨清單】${menu.storeName} ${menu.menuDate}`];
          for (const { itemName, price, qty } of itemQtyMap.values()) {
            if (qty === 0) continue;
            const subtotal = price * qty;
            lines.push(`${itemName} × ${qty}（$${subtotal}）`);
            totalQty += qty;
            totalAmt += subtotal;
          }
          lines.push("──────────");
          lines.push(`合計：${totalQty} 份 $${totalAmt}`);

          await client.pushMessage({ to: groupId, messages: [{ type: "text", text: lines.join("\n") }] });
          summariesPushed.push(`${menu.menuDate} ${menu.storeName}`);
        } catch (err) {
          console.error(`[cron menu-maintenance] 推播叫貨清單失敗（${menu.storeName}）：`, err);
        }
      }
    }
  }

  if (remindersSent.length > 0 || closed.length > 0) {
    console.log(
      `[cron menu-maintenance] 提醒 ${remindersSent.length} 張、關閉 ${closed.length} 張、推播叫貨清單 ${summariesPushed.length} 張`,
      { remindersSent, closed, summariesPushed }
    );
  }

  return NextResponse.json({
    status: "ok",
    remindersSentCount: remindersSent.length,
    remindersSent,
    closedCount: closed.length,
    closed,
    summariesPushedCount: summariesPushed.length,
    summariesPushed,
  });
}
