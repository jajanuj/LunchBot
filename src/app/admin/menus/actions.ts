"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { createMenu, closeMenu, deleteMenu } from "@/lib/data/menus";
import { upsertTemplate } from "@/lib/data/storeTemplates";

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

export async function deleteMenuAction(formData: FormData): Promise<void> {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteMenu(id);
  }
  revalidatePath("/admin/menus");
  redirect("/admin/menus");
}
