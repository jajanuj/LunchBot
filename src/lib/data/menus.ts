// 菜單的「資料存取」抽象層（對應 docs/LunchBot-plan.md 4.4、4.5）。
// 目前狀態：先用伺服器記憶體陣列頂著，之後接 Supabase 時把函式內部換成
// 查詢 menus / menu_items 即可，呼叫端（Server Actions / 頁面）不需要改動。
//
// ⚠️ 用 globalThis 存資料，不要改回單純的 module-level 變數：
// 實測發現 Next.js 的 Route Handler（/api/**/route.ts）跟 Server Action
// 在 Turbopack dev 模式下可能被打包成不同的模組執行環境，各自 import 到
//「不同份」的同一個檔案，單純的 `const menus = []` 會各自獨立、互不相通
// （後台建立的菜單，API Route 端完全看不到）。globalThis 是整個 process
// 共用的，才能確保兩邊讀到同一份假資料。
import { randomUUID } from "node:crypto";

export type MenuItemRecord = {
  id: string;
  itemName: string;
  price: number;
};

export type MenuStatus = "open" | "closed" | "cancelled";

export type Menu = {
  id: string;
  menuDate: string; // YYYY-MM-DD
  sessionName: string | null;
  storeName: string;
  cutoffTime: string; // ISO datetime
  reminderMinutesBefore: number | null;
  reminderSentAt: string | null;
  status: MenuStatus;
  items: MenuItemRecord[];
};

export type MenuItemInput = { itemName: string; price: number };

export type CreateMenuInput = {
  menuDate: string;
  sessionName: string | null;
  storeName: string;
  cutoffTime: string;
  reminderMinutesBefore?: number | null;
  items: MenuItemInput[];
};

declare global {
  var __lunchbot_menus__: Menu[] | undefined;
}

const menus: Menu[] = (globalThis.__lunchbot_menus__ ??= []);

export async function listMenus(): Promise<Menu[]> {
  return [...menus].sort((a, b) => (a.menuDate < b.menuDate ? 1 : -1));
}

export async function getMenu(id: string): Promise<Menu | undefined> {
  return menus.find((m) => m.id === id);
}

/** 同一天「收單中」的所有菜單，用於合併推播成同一則 Carousel 訊息（見計劃文件設計決策 1）。 */
export async function listOpenMenusByDate(menuDate: string): Promise<Menu[]> {
  return menus.filter((m) => m.menuDate === menuDate && m.status === "open");
}

export type CreateMenuResult = { ok: true; menu: Menu } | { ok: false; error: string };

export async function createMenu(input: CreateMenuInput): Promise<CreateMenuResult> {
  const storeName = input.storeName.trim();
  if (!storeName) {
    return { ok: false, error: "店家名稱不可為空" };
  }
  if (!input.menuDate) {
    return { ok: false, error: "請選擇點餐日期" };
  }
  if (!input.cutoffTime) {
    return { ok: false, error: "請設定收單截止時間" };
  }

  const validItems = input.items.filter((i) => i.itemName.trim().length > 0);
  if (validItems.length === 0) {
    return { ok: false, error: "請至少新增一個品項" };
  }
  if (validItems.some((i) => !Number.isFinite(i.price) || i.price < 0)) {
    return { ok: false, error: "品項價格必須是大於等於 0 的數字" };
  }

  // 對應資料庫的 unique (menu_date, store_name) 約束
  if (menus.some((m) => m.menuDate === input.menuDate && m.storeName === storeName)) {
    return { ok: false, error: `${input.menuDate} 已經有「${storeName}」的菜單了，不可重複建立` };
  }

  const menu: Menu = {
    id: randomUUID(),
    menuDate: input.menuDate,
    sessionName: input.sessionName?.trim() || null,
    storeName,
    cutoffTime: input.cutoffTime,
    reminderMinutesBefore:
      input.reminderMinutesBefore && input.reminderMinutesBefore > 0
        ? input.reminderMinutesBefore
        : null,
    reminderSentAt: null,
    status: "open",
    items: validItems.map((i) => ({
      id: randomUUID(),
      itemName: i.itemName.trim(),
      price: Math.round(i.price),
    })),
  };
  menus.push(menu);
  return { ok: true, menu };
}

export async function closeMenu(id: string): Promise<void> {
  const menu = menus.find((m) => m.id === id);
  if (menu) {
    menu.status = "closed";
  }
}

/**
 * 找出「收單中、設定了提醒分鐘數、還沒發過提醒、且現在已經進入提醒區間」
 * 的菜單（對應計劃文件流程三的提醒分支）。
 */
export async function findMenusDueForReminder(now: Date = new Date()): Promise<Menu[]> {
  return menus.filter((menu) => {
    if (menu.status !== "open") return false;
    if (!menu.reminderMinutesBefore) return false;
    if (menu.reminderSentAt) return false;
    const reminderAt = new Date(menu.cutoffTime).getTime() - menu.reminderMinutesBefore * 60_000;
    return now.getTime() >= reminderAt;
  });
}

export async function markReminderSent(id: string, sentAt: Date = new Date()): Promise<void> {
  const menu = menus.find((m) => m.id === id);
  if (menu) {
    menu.reminderSentAt = sentAt.toISOString();
  }
}

export type ClosedMenuSummary = { id: string; storeName: string; menuDate: string };

/**
 * 把所有「收單中」且已經過截止時間的菜單自動關閉。
 * 給排程（Vercel Cron / 定時觸發）呼叫，對應計劃文件流程三。
 */
export async function closeExpiredMenus(now: Date = new Date()): Promise<ClosedMenuSummary[]> {
  const closed: ClosedMenuSummary[] = [];
  for (const menu of menus) {
    if (menu.status === "open" && new Date(menu.cutoffTime).getTime() <= now.getTime()) {
      menu.status = "closed";
      closed.push({ id: menu.id, storeName: menu.storeName, menuDate: menu.menuDate });
    }
  }
  return closed;
}

export async function deleteMenu(id: string): Promise<void> {
  const index = menus.findIndex((m) => m.id === id);
  if (index !== -1) {
    menus.splice(index, 1);
  }
}
