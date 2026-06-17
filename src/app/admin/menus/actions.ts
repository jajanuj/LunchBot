"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { createMenu, closeMenu, deleteMenu, getMenu, listOpenMenusByDate } from "@/lib/data/menus";
import { upsertTemplate } from "@/lib/data/storeTemplates";
import { upsertOrder, cancelOrder } from "@/lib/data/orders";
import { linkMenuAiImport } from "@/lib/data/menuAiImports";
import { buildMenuCarouselMessage } from "@/lib/line/flexMessage";
import { getLineMessagingClient } from "@/lib/line/client";

export type CreateMenuActionState = { error?: string } | undefined;

export async function createMenuAction(
  _prevState: CreateMenuActionState,
  formData: FormData
): Promise<CreateMenuActionState> {
  const user = await verifySession();

  const menuDate = String(formData.get("menuDate") ?? "");
  const sessionName = String(formData.get("sessionName") ?? "");
  const storeName = String(formData.get("storeName") ?? "");
  const cutoffTime = String(formData.get("cutoffTime") ?? "");
  const reminderMinutesBeforeRaw = String(formData.get("reminderMinutesBefore") ?? "");
  const itemNames = formData.getAll("itemName").map(String);
  const itemPrices = formData.getAll("itemPrice").map(String);
  const saveAsTemplate = formData.get("saveAsTemplate") === "on";
  const aiImportId = String(formData.get("aiImportId") ?? "");

  const items = itemNames.map((name, i) => ({
    itemName: name,
    price: Number(itemPrices[i]),
  }));

  const result = await createMenu({
    menuDate,
    sessionName: sessionName || null,
    storeName,
    cutoffTime,
    reminderMinutesBefore: reminderMinutesBeforeRaw ? Number(reminderMinutesBeforeRaw) : null,
    items,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  if (saveAsTemplate) {
    const validItems = items.filter((i) => i.itemName.trim().length > 0);
    await upsertTemplate(storeName, validItems);
  }

  // 若此次建立來自 AI 辨識，回填 menu_id 與助理校對後的品項
  if (aiImportId) {
    const reviewedItems = result.menu.items.map((i) => ({
      itemName: i.itemName,
      price: i.price,
    }));
    await linkMenuAiImport(aiImportId, result.menu.id, reviewedItems, user.displayName);
  }

  revalidatePath("/admin/menus");
  redirect("/admin/menus");
}

export async function closeMenuAction(formData: FormData): Promise<void> {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (id) {
    await closeMenu(id);
  }
  revalidatePath("/admin/menus");
  revalidatePath(`/admin/menus/${id}`);
}

export type PushMenuNotificationActionState =
  | { error?: string; success?: boolean; pushedCount?: number }
  | undefined;

export async function pushMenuNotificationAction(
  _prevState: PushMenuNotificationActionState,
  formData: FormData
): Promise<PushMenuNotificationActionState> {
  await verifySession();

  const menuId = String(formData.get("menuId") ?? "");
  const menu = await getMenu(menuId);
  if (!menu) {
    return { error: "找不到這張菜單" };
  }

  const groupId = process.env.LINE_GROUP_ID;
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  if (!groupId) {
    return { error: "環境變數 LINE_GROUP_ID 未設定，請先在 .env.local 加入（見 docs/PROGRESS.md）" };
  }
  if (!liffId) {
    return { error: "環境變數 NEXT_PUBLIC_LINE_LIFF_ID 未設定" };
  }

  // 同一天「收單中」的菜單合併成一則 Carousel 訊息一起推播（設計決策見計劃文件）
  const sameDayOpenMenus = await listOpenMenusByDate(menu.menuDate);
  if (sameDayOpenMenus.length === 0) {
    return { error: "這張菜單目前不是收單中狀態，無法推播" };
  }

  const message = buildMenuCarouselMessage(sameDayOpenMenus, liffId);

  try {
    const client = getLineMessagingClient();
    await client.pushMessage({ to: groupId, messages: [message] });
  } catch (err) {
    // @line/bot-sdk 拋出的 HTTPFetchError 帶有 .body 欄位，包含 LINE API 的詳細錯誤
    let detail = err instanceof Error ? err.message : "未知錯誤";
    if (err && typeof err === "object" && "body" in err) {
      try {
        const parsed = JSON.parse(String((err as { body: unknown }).body));
        if (parsed?.message) detail = `${detail}（${parsed.message}）`;
      } catch {
        detail = `${detail}（${String((err as { body: unknown }).body)}）`;
      }
    }
    console.error("[push menu notification] 推播失敗：", err);
    return { error: `推播失敗：${detail}` };
  }

  return { success: true, pushedCount: sameDayOpenMenus.length };
}

export type AssistedOrderActionState = { error?: string; success?: boolean } | undefined;

/**
 * 助理在後台代客新增/修改訂單（臨時插單、事後修正用）。
 * 不受 menus.status 是否為 open 限制，寫入時標記 orders.source = 'assisted'。
 */
export async function assistedUpsertOrderAction(
  _prevState: AssistedOrderActionState,
  formData: FormData
): Promise<AssistedOrderActionState> {
  await verifySession();

  const menuId = String(formData.get("menuId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) {
    return { error: "請選擇要代下單的員工" };
  }

  const menuItemIds = formData.getAll("menuItemId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const items = menuItemIds.map((menuItemId, i) => ({
    menuItemId,
    quantity: Number(quantities[i] ?? 0),
  }));

  const result = await upsertOrder(menuId, employeeId, items, "assisted");
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/admin/menus/${menuId}`);
  return { success: true };
}

export async function assistedCancelOrderAction(formData: FormData): Promise<void> {
  await verifySession();

  const menuId = String(formData.get("menuId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (menuId && employeeId) {
    await cancelOrder(menuId, employeeId);
  }
  revalidatePath(`/admin/menus/${menuId}`);
}

export async function deleteMenuAction(formData: FormData): Promise<void> {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteMenu(id);
  }
  revalidatePath("/admin/menus");
  redirect("/admin/menus");
}

export async function batchDeleteMenusAction(formData: FormData): Promise<void> {
  await verifySession();

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  await Promise.all(ids.map((id) => deleteMenu(id)));
  revalidatePath("/admin/menus");
}
