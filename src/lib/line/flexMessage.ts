// 把菜單資料組成 LINE Flex Message（Carousel 多頁卡片）。
// 純函式，不呼叫任何網路 API，方便寫單元測試（見 e2e/line-flex-message.test.mjs）。
// 設計依據：docs/LunchBot-plan.md 第 5 節「流程一」的範例 JSON。
import type { messagingApi } from "@line/bot-sdk";
import type { Menu } from "@/lib/data/menus";

function formatCutoffTime(cutoffTimeIso: string): string {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(cutoffTimeIso));
}

function sessionEmoji(sessionName: string | null): string {
  if (sessionName?.includes("飲") || sessionName?.includes("茶")) return "🥤";
  if (sessionName?.includes("午餐")) return "🍱";
  if (sessionName?.includes("早餐")) return "🍳";
  if (sessionName?.includes("晚餐")) return "🍽️";
  return "📋";
}

function buildMenuBubble(menu: Menu, liffId: string): messagingApi.FlexBubble {
  const title = `${sessionEmoji(menu.sessionName)} ${menu.sessionName ?? "點餐"}｜${menu.storeName}`;

  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "text", text: title, weight: "bold", size: "lg", wrap: true }],
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `截止時間：${formatCutoffTime(menu.cutoffTime)}`,
          size: "sm",
          color: "#999999",
        },
        {
          type: "text",
          text: `共 ${menu.items.length} 個品項`,
          size: "sm",
          color: "#999999",
          margin: "sm",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          action: {
            type: "uri",
            label: "我要點餐",
            uri: `https://liff.line.me/${liffId}?menuId=${menu.id}`,
          },
        },
      ],
    },
  };
}

/**
 * @param menus 同一天要合併呈現的菜單（多場次時用 Carousel 滑動，見計劃文件設計決策 1）
 * @param liffId LIFF App ID，組成「我要點餐」按鈕的網址
 */
export function buildMenuCarouselMessage(
  menus: Menu[],
  liffId: string
): messagingApi.FlexMessage {
  if (menus.length === 0) {
    throw new Error("buildMenuCarouselMessage: menus 不可為空陣列");
  }

  const sessionLabels = menus.map((m) => m.sessionName ?? m.storeName).join("、");
  const dateLabel = menus[0].menuDate.slice(5).replace("-", "/"); // YYYY-MM-DD -> MM/DD

  return {
    type: "flex",
    altText: `📋 ${dateLabel} 訂餐通知：${sessionLabels}`,
    contents: {
      type: "carousel",
      contents: menus.map((menu) => buildMenuBubble(menu, liffId)),
    },
  };
}

/** 截止前提醒推播的純文字訊息（對應計劃文件流程三範例：「午餐 12:00 截止，尚未點餐請盡速」）。 */
export function buildReminderText(menu: Menu): string {
  const title = menu.sessionName ?? menu.storeName;
  return `⏰ ${title}將於 ${formatCutoffTime(menu.cutoffTime)} 截止收單，尚未點餐請盡速！`;
}
