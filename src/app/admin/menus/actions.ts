"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { createMenu, closeMenu, deleteMenu, getMenu, listOpenMenusByDate } from "@/lib/data/menus";
import { upsertTemplate } from "@/lib/data/storeTemplates";
import { buildMenuCarouselMessage } from "@/lib/line/flexMessage";
import { getLineMessagingClient } from "@/lib/line/client";

export type CreateMenuActionState = { error?: string } | undefined;

export async function createMenuAction(
  _prevState: CreateMenuActionState,
  formData: FormData
): Promise<CreateMenuActionState> {
  await verifySession();

  const menuDate = String(formData.get("menuDate") ?? "");
  const sessionName = String(formData.get("sessionName") ?? "");
  const storeName = String(formData.get("storeName") ?? "");
  const cutoffTime = String(formData.get("cutoffTime") ?? "");
  const reminderMinutesBeforeRaw = String(formData.get("reminderMinutesBefore") ?? "");
  const itemNames = formData.getAll("itemName").map(String);
  const itemPrices = formData.getAll("itemPrice").map(String);
  const saveAsTemplate = formData.get("saveAsTemplate") === "on";

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
    console.error("[push menu notification] 推播失敗：", err);
    return {
      error: `推播失敗：${err instanceof Error ? err.message : "未知錯誤"}`,
    };
  }

  return { success: true, pushedCount: sameDayOpenMenus.length };
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
