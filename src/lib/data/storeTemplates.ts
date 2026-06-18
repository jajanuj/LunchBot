import { supabase } from "../supabase";

export type TemplateItem = {
  id: string;
  itemName: string;
  price: number;
};

export type StoreTemplate = {
  id: string;
  storeName: string;
  lastUsedAt: string | null;
  items: TemplateItem[];
};

export type TemplateItemInput = { itemName: string; price: number };

type TemplateRow = {
  id: string;
  store_name: string;
  last_used_at: string | null;
  template_items: { id: string; item_name: string; price: number }[];
};

function toTemplate(row: TemplateRow): StoreTemplate {
  return {
    id: row.id,
    storeName: row.store_name,
    lastUsedAt: row.last_used_at,
    items: (row.template_items ?? []).map((i) => ({
      id: i.id,
      itemName: i.item_name,
      price: i.price,
    })),
  };
}

export async function listTemplates(): Promise<StoreTemplate[]> {
  const { data, error } = await supabase
    .from("store_templates")
    .select("id, store_name, last_used_at, template_items(id, item_name, price)")
    .order("store_name");
  if (error) throw new Error(error.message);
  return (data as TemplateRow[]).map(toTemplate);
}

export async function getTemplate(id: string): Promise<StoreTemplate | undefined> {
  const { data, error } = await supabase
    .from("store_templates")
    .select("id, store_name, last_used_at, template_items(id, item_name, price)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTemplate(data as TemplateRow) : undefined;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("store_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTemplatesBatch(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("store_templates").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

export async function updateTemplateFull(
  id: string,
  storeName: string,
  items: TemplateItemInput[]
): Promise<StoreTemplate> {
  const trimmedName = storeName.trim();

  const { error: nameErr } = await supabase
    .from("store_templates")
    .update({ store_name: trimmedName })
    .eq("id", id);
  if (nameErr) throw new Error(nameErr.message);

  // 刪除舊品項，重新插入
  const { error: delErr } = await supabase
    .from("template_items")
    .delete()
    .eq("template_id", id);
  if (delErr) throw new Error(delErr.message);

  const { data: newItems, error: insertErr } = await supabase
    .from("template_items")
    .insert(items.map((i) => ({ template_id: id, item_name: i.itemName, price: i.price })))
    .select("id, item_name, price");
  if (insertErr) throw new Error(insertErr.message);

  return {
    id,
    storeName: trimmedName,
    lastUsedAt: null,
    items: (newItems as { id: string; item_name: string; price: number }[]).map((i) => ({
      id: i.id,
      itemName: i.item_name,
      price: i.price,
    })),
  };
}

export async function upsertTemplate(
  storeName: string,
  items: TemplateItemInput[]
): Promise<StoreTemplate> {
  const trimmedName = storeName.trim();

  // upsert store_templates（衝突時更新 last_used_at）
  const { data: tmpl, error: tmplErr } = await supabase
    .from("store_templates")
    .upsert(
      { store_name: trimmedName, last_used_at: new Date().toISOString() },
      { onConflict: "store_name" }
    )
    .select("id, store_name, last_used_at")
    .single();
  if (tmplErr) throw new Error(tmplErr.message);

  const templateId = (tmpl as { id: string }).id;

  // 刪除舊品項，再重新插入（template_items 有 ON DELETE CASCADE，但這裡只刪品項）
  const { error: delErr } = await supabase
    .from("template_items")
    .delete()
    .eq("template_id", templateId);
  if (delErr) throw new Error(delErr.message);

  const { data: newItems, error: insertErr } = await supabase
    .from("template_items")
    .insert(
      items.map((i) => ({
        template_id: templateId,
        item_name: i.itemName,
        price: i.price,
      }))
    )
    .select("id, item_name, price");
  if (insertErr) throw new Error(insertErr.message);

  return {
    id: templateId,
    storeName: trimmedName,
    lastUsedAt: (tmpl as { last_used_at: string }).last_used_at,
    items: (newItems as { id: string; item_name: string; price: number }[]).map((i) => ({
      id: i.id,
      itemName: i.item_name,
      price: i.price,
    })),
  };
}
