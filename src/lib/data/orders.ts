import { supabase } from "../supabase";
import { getMenu } from "./menus";

export type OrderItemRecord = {
  id: string;
  menuItemId: string;
  itemName: string;
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

type OrderRow = {
  id: string;
  menu_id: string;
  employee_id: string;
  total_amount: number;
  status: string;
  source: string;
  order_items: {
    id: string;
    menu_item_id: string;
    quantity: number;
    custom_notes: string | null;
    menu_items: { item_name: string; price: number };
  }[];
};

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    menuId: row.menu_id,
    employeeId: row.employee_id,
    totalAmount: row.total_amount,
    status: row.status as OrderStatus,
    source: row.source as OrderSource,
    items: (row.order_items ?? []).map((i) => ({
      id: i.id,
      menuItemId: i.menu_item_id,
      itemName: i.menu_items.item_name,
      price: i.menu_items.price,
      quantity: i.quantity,
      customNotes: i.custom_notes,
    })),
  };
}

const ORDER_SELECT =
  "id, menu_id, employee_id, total_amount, status, source, order_items(id, menu_item_id, quantity, custom_notes, menu_items(item_name, price))";

export async function getOrder(menuId: string, employeeId: string): Promise<Order | undefined> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("menu_id", menuId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toOrder(data as unknown as OrderRow) : undefined;
}

export async function listOrdersByMenu(menuId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("menu_id", menuId);
  if (error) throw new Error(error.message);
  return (data as unknown as OrderRow[]).map(toOrder);
}

export type UpsertOrderResult = { ok: true; order: Order } | { ok: false; error: string };

export async function upsertOrder(
  menuId: string,
  employeeId: string,
  items: OrderItemInput[],
  source: OrderSource
): Promise<UpsertOrderResult> {
  // 取菜單（含品項），同時驗證狀態
  const menu = await getMenu(menuId);
  if (!menu) return { ok: false, error: "找不到這張菜單" };
  if (source === "self" && menu.status !== "open") {
    return { ok: false, error: "這張菜單已經截止收單，無法送出/修改訂單" };
  }

  const validItems = items.filter((i) => i.quantity > 0);
  if (validItems.length === 0) return { ok: false, error: "請至少選擇一個品項" };

  // 驗證品項並計算金額
  const resolvedItems: { menuItemId: string; itemName: string; price: number; quantity: number; customNotes: string | null }[] = [];
  for (const item of validItems) {
    const menuItem = menu.items.find((mi) => mi.id === item.menuItemId);
    if (!menuItem) return { ok: false, error: "品項不存在於這張菜單，請重新整理頁面" };
    resolvedItems.push({
      menuItemId: menuItem.id,
      itemName: menuItem.itemName,
      price: menuItem.price,
      quantity: item.quantity,
      customNotes: item.customNotes?.trim() || null,
    });
  }

  const totalAmount = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Upsert order（衝突時更新）
  const { data: orderData, error: orderErr } = await supabase
    .from("orders")
    .upsert(
      {
        menu_id: menuId,
        employee_id: employeeId,
        total_amount: totalAmount,
        status: "pending",
        source,
      },
      { onConflict: "menu_id,employee_id" }
    )
    .select("id")
    .single();
  if (orderErr) throw new Error(orderErr.message);

  const orderId = (orderData as { id: string }).id;

  // 刪除舊品項，重新插入（order_items 有 ON DELETE CASCADE on order_id）
  const { error: delErr } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);
  if (delErr) throw new Error(delErr.message);

  const { error: insertErr } = await supabase.from("order_items").insert(
    resolvedItems.map((i) => ({
      order_id: orderId,
      menu_item_id: i.menuItemId,
      quantity: i.quantity,
      custom_notes: i.customNotes,
    }))
  );
  if (insertErr) throw new Error(insertErr.message);

  const order = await getOrder(menuId, employeeId);
  return { ok: true, order: order! };
}

export async function cancelOrder(menuId: string, employeeId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("menu_id", menuId)
    .eq("employee_id", employeeId);
  if (error) throw new Error(error.message);
}
