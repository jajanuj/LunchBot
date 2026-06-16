// 訂單的「資料存取」抽象層（對應 docs/LunchBot-plan.md 4.7、4.8）。
// 目前狀態：先用伺服器記憶體陣列頂著，之後接 Supabase 時把函式內部換成
// 查詢 orders / order_items 即可，呼叫端（Server Actions / 頁面）不需要改動。
//
// ⚠️ 用 globalThis 存資料，原因見 src/lib/data/menus.ts 開頭註解
// （Route Handler 跟 Server Action 在 dev 模式下可能各自有獨立模組實例）。
import { randomUUID } from "node:crypto";
import { getMenu } from "./menus";

export type OrderItemRecord = {
  id: string;
  menuItemId: string;
  itemName: string; // 為了顯示方便，下單當下把品名一起記下來（即使之後菜單品項被改也不影響歷史訂單顯示）
  price: number;
  quantity: number;
  customNotes: string | null;
};

export type OrderStatus = "pending" | "cancelled";
export type OrderSource = "self" | "assisted";

export type Order = {
  id: string;
  menuId: string;
  employeeId: string;
  totalAmount: number;
  status: OrderStatus;
  source: OrderSource;
  items: OrderItemRecord[];
};

export type OrderItemInput = {
  menuItemId: string;
  quantity: number;
  customNotes?: string | null;
};

declare global {
  var __lunchbot_orders__: Order[] | undefined;
}

const orders: Order[] = (globalThis.__lunchbot_orders__ ??= []);

export async function getOrder(menuId: string, employeeId: string): Promise<Order | undefined> {
  return orders.find((o) => o.menuId === menuId && o.employeeId === employeeId);
}

export type UpsertOrderResult = { ok: true; order: Order } | { ok: false; error: string };

/**
 * 新增或更新訂單（依 (menu_id, employee_id) 視為同一筆，這就是計劃文件設計
 * 決策裡說的「送出動作實作為 upsert，支援截止前修改訂單」）。
 *
 * @param source `self`：員工自助透過 LIFF 送出，受 menu 是否為 open 限制；
 *   `assisted`：助理代客新增/修改，不受此限制。
 */
export async function upsertOrder(
  menuId: string,
  employeeId: string,
  items: OrderItemInput[],
  source: OrderSource
): Promise<UpsertOrderResult> {
  const menu = await getMenu(menuId);
  if (!menu) {
    return { ok: false, error: "找不到這張菜單" };
  }
  if (source === "self" && menu.status !== "open") {
    return { ok: false, error: "這張菜單已經截止收單，無法送出/修改訂單" };
  }

  const validItems = items.filter((i) => i.quantity > 0);
  if (validItems.length === 0) {
    return { ok: false, error: "請至少選擇一個品項" };
  }

  const resolvedItems: OrderItemRecord[] = [];
  for (const item of validItems) {
    const menuItem = menu.items.find((mi) => mi.id === item.menuItemId);
    if (!menuItem) {
      return { ok: false, error: "品項不存在於這張菜單，請重新整理頁面" };
    }
    resolvedItems.push({
      id: randomUUID(),
      menuItemId: menuItem.id,
      itemName: menuItem.itemName,
      price: menuItem.price,
      quantity: item.quantity,
      customNotes: item.customNotes?.trim() || null,
    });
  }

  const totalAmount = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const existing = orders.find((o) => o.menuId === menuId && o.employeeId === employeeId);
  if (existing) {
    existing.items = resolvedItems;
    existing.totalAmount = totalAmount;
    existing.status = "pending";
    existing.source = source;
    return { ok: true, order: existing };
  }

  const order: Order = {
    id: randomUUID(),
    menuId,
    employeeId,
    totalAmount,
    status: "pending",
    source,
    items: resolvedItems,
  };
  orders.push(order);
  return { ok: true, order };
}

export async function cancelOrder(menuId: string, employeeId: string): Promise<void> {
  const order = orders.find((o) => o.menuId === menuId && o.employeeId === employeeId);
  if (order) {
    order.status = "cancelled";
  }
}
