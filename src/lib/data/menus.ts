// 菜單的「資料存取」抽象層（對應 docs/LunchBot-plan.md 4.4、4.5）。
// 目前狀態：先用伺服器記憶體陣列頂著，之後接 Supabase 時把函式內部換成
// 查詢 menus / menu_items 即可，呼叫端（Server Actions / 頁面）不需要改動。
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
  status: MenuStatus;
  items: MenuItemRecord[];
};

export type MenuItemInput = { itemName: string; price: number };

export type CreateMenuInput = {
  menuDate: string;
  sessionName: string | null;
  storeName: string;
  cutoffTime: string;
  items: MenuItemInput[];
};

const menus: Menu[] = [];

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

export async function deleteMenu(id: string): Promise<void> {
  const index = menus.findIndex((m) => m.id === id);
  if (index !== -1) {
    menus.splice(index, 1);
  }
}
