import { supabase } from "../supabase.ts";

export type AiImportItem = { itemName: string; price: number };

export async function createMenuAiImport(input: {
  storeName: string;
  imagePath: string;
  rawResponse: unknown;
}): Promise<string> {
  const { data, error } = await supabase
    .from("menu_ai_imports")
    .insert({
      store_name: input.storeName,
      image_path: input.imagePath,
      raw_response: input.rawResponse,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function linkMenuAiImport(
  importId: string,
  menuId: string,
  reviewedItems: AiImportItem[],
  reviewedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("menu_ai_imports")
    .update({
      menu_id: menuId,
      reviewed_items: reviewedItems,
      reviewed_by: reviewedBy.slice(0, 20),
    })
    .eq("id", importId);
  if (error) throw new Error(error.message);
}
