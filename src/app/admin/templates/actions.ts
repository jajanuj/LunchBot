"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { deleteTemplate, deleteTemplatesBatch, updateTemplateFull } from "@/lib/data/storeTemplates";

export async function deleteTemplateAction(
  formData: FormData
): Promise<{ error?: string }> {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "缺少樣板 ID" };
  try {
    await deleteTemplate(id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/admin/templates");
  return {};
}

export async function batchDeleteTemplatesAction(
  formData: FormData
): Promise<{ error?: string }> {
  await verifySession();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "未選取任何樣板" };
  try {
    await deleteTemplatesBatch(ids);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/admin/templates");
  return {};
}

export type UpdateTemplateState = { error?: string } | undefined;

export async function updateTemplateAction(
  _prevState: UpdateTemplateState,
  formData: FormData
): Promise<UpdateTemplateState> {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const storeName = String(formData.get("storeName") ?? "").trim();
  if (!storeName) return { error: "店家名稱不可為空" };

  const itemNames = formData.getAll("itemName").map(String);
  const itemPrices = formData.getAll("itemPrice").map(String);
  const items = itemNames
    .map((name, i) => ({ itemName: name.trim(), price: Number(itemPrices[i]) }))
    .filter((item) => item.itemName.length > 0);

  if (items.length === 0) return { error: "至少需要一個品項" };

  try {
    await updateTemplateFull(id, storeName, items);
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/admin/templates");
  redirect("/admin/templates");
}
