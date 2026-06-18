import { supabase } from "../supabase.ts";

export type MenuItemCategory = "food" | "drink";

export type MenuItemRecord = {
  id: string;
  itemName: string;
  price: number;
  category: MenuItemCategory | null;
};

export type MenuStatus = "open" | "closed" | "cancelled";

export type Menu = {
  id: string;
  menuDate: string;
  sessionName: string | null;
  storeName: string;
  cutoffTime: string;
  reminderMinutesBefore: number | null;
  reminderSentAt: string | null;
  status: MenuStatus;
  items: MenuItemRecord[];
};

export type MenuItemInput = { itemName: string; price: number; category?: MenuItemCategory | null };

export type CreateMenuInput = {
  menuDate: string;
  sessionName: string | null;
  storeName: string;
  cutoffTime: string;
  reminderMinutesBefore?: number | null;
  items: MenuItemInput[];
};

type MenuRow = {
  id: string;
  menu_date: string;
  session_name: string | null;
  store_name: string;
  cutoff_time: string;
  reminder_minutes_before: number | null;
  reminder_sent_at: string | null;
  status: string;
  menu_items: { id: string; item_name: string; price: number; category: string | null }[];
};

function toMenu(row: MenuRow): Menu {
  return {
    id: row.id,
    menuDate: row.menu_date,
    sessionName: row.session_name,
    storeName: row.store_name,
    cutoffTime: row.cutoff_time,
    reminderMinutesBefore: row.reminder_minutes_before,
    reminderSentAt: row.reminder_sent_at,
    status: row.status as MenuStatus,
    items: (row.menu_items ?? []).map((i) => ({
      id: i.id,
      itemName: i.item_name,
      price: i.price,
      category: (i.category ?? null) as MenuItemCategory | null,
    })),
  };
}

// category 欄位在 migration 0005 套用後才存在，MENU_SELECT 待 migration 套用後再加回
const MENU_SELECT = "id, menu_date, session_name, store_name, cutoff_time, reminder_minutes_before, reminder_sent_at, status, menu_items(id, item_name, price)";

export async function listMenus(since?: string): Promise<Menu[]> {
  let query = supabase.from("menus").select(MENU_SELECT).order("menu_date", { ascending: false });
  if (since) query = query.gte("menu_date", since);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as MenuRow[]).map(toMenu);
}

export async function getMenu(id: string): Promise<Menu | undefined> {
  const { data, error } = await supabase
    .from("menus")
    .select(MENU_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toMenu(data as MenuRow) : undefined;
}

export async function listOpenMenusByDate(menuDate: string): Promise<Menu[]> {
  const { data, error } = await supabase
    .from("menus")
    .select(MENU_SELECT)
    .eq("menu_date", menuDate)
    .eq("status", "open");
  if (error) throw new Error(error.message);
  return (data as MenuRow[]).map(toMenu);
}

export type CreateMenuResult = { ok: true; menu: Menu } | { ok: false; error: string };

export async function createMenu(input: CreateMenuInput): Promise<CreateMenuResult> {
  const storeName = input.storeName.trim();
  if (!storeName) return { ok: false, error: "店家名稱不可為空" };
  if (!input.menuDate) return { ok: false, error: "請選擇點餐日期" };
  if (!input.cutoffTime) return { ok: false, error: "請設定收單截止時間" };

  const validItems = input.items.filter((i) => i.itemName.trim().length > 0);
  if (validItems.length === 0) return { ok: false, error: "請至少新增一個品項" };
  if (validItems.some((i) => !Number.isFinite(i.price) || i.price < 0)) {
    return { ok: false, error: "品項價格必須是大於等於 0 的數字" };
  }

  const reminderMinutesBefore =
    input.reminderMinutesBefore && input.reminderMinutesBefore > 0
      ? input.reminderMinutesBefore
      : null;

  // datetime-local 輸入值沒有時區資訊，需要先用 new Date() 以本機時區解析
  // 再轉成 UTC ISO 字串，否則 Supabase（PostgreSQL session = UTC）會把它當 UTC
  // 讀，造成跨時區比對錯誤（台灣 UTC+8 的「11:30」會被當成「11:30 UTC」存入）
  const cutoffTimeISO = new Date(input.cutoffTime).toISOString();

  const { data: menu, error: menuErr } = await supabase
    .from("menus")
    .insert({
      menu_date: input.menuDate,
      session_name: input.sessionName?.trim() || null,
      store_name: storeName,
      cutoff_time: cutoffTimeISO,
      reminder_minutes_before: reminderMinutesBefore,
      status: "open",
    })
    .select("id")
    .single();

  if (menuErr) {
    if (menuErr.code === "23505") {
      return { ok: false, error: `${input.menuDate} 已經有「${storeName}」的菜單了，不可重複建立` };
    }
    throw new Error(menuErr.message);
  }

  const menuId = (menu as { id: string }).id;

  const { error: itemsErr } = await supabase.from("menu_items").insert(
    validItems.map((i) => ({
      menu_id: menuId,
      item_name: i.itemName.trim(),
      price: Math.round(i.price),
      // 只有 migration 0005 套用後才有 category 欄位；不送 null 避免欄位不存在時 422 錯誤
      ...(i.category ? { category: i.category } : {}),
    }))
  );
  if (itemsErr) throw new Error(itemsErr.message);

  const created = await getMenu(menuId);
  return { ok: true, menu: created! };
}

export async function closeMenu(id: string): Promise<void> {
  const { error } = await supabase
    .from("menus")
    .update({ status: "closed" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function findMenusDueForReminder(now: Date = new Date()): Promise<Menu[]> {
  const { data, error } = await supabase
    .from("menus")
    .select(MENU_SELECT)
    .eq("status", "open")
    .not("reminder_minutes_before", "is", null)
    .is("reminder_sent_at", null);
  if (error) throw new Error(error.message);

  return (data as MenuRow[])
    .map(toMenu)
    .filter((menu) => {
      const reminderAt =
        new Date(menu.cutoffTime).getTime() - menu.reminderMinutesBefore! * 60_000;
      return now.getTime() >= reminderAt;
    });
}

export async function markReminderSent(id: string, sentAt: Date = new Date()): Promise<void> {
  const { error } = await supabase
    .from("menus")
    .update({ reminder_sent_at: sentAt.toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type ClosedMenuSummary = { id: string; storeName: string; menuDate: string };

export async function closeExpiredMenus(now: Date = new Date()): Promise<ClosedMenuSummary[]> {
  const { data, error } = await supabase
    .from("menus")
    .update({ status: "closed" })
    .eq("status", "open")
    .lte("cutoff_time", now.toISOString())
    .select("id, store_name, menu_date");
  if (error) throw new Error(error.message);
  return (data as { id: string; store_name: string; menu_date: string }[]).map((r) => ({
    id: r.id,
    storeName: r.store_name,
    menuDate: r.menu_date,
  }));
}

export async function deleteMenu(id: string): Promise<void> {
  const { error } = await supabase.from("menus").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
