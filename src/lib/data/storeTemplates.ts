// 店家歷史樣板的「資料存取」抽象層（對應 docs/LunchBot-plan.md 4.2、4.3）。
// 目前狀態：同 employees.ts，先用伺服器記憶體陣列頂著，之後接 Supabase 時
// 把函式內部換成查詢 store_templates / template_items 即可。
import { randomUUID } from "node:crypto";

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

// 種子資料：示範一個常用店家樣板，方便登入後就能體驗「套用樣板」流程。
const templates: StoreTemplate[] = [
  {
    id: randomUUID(),
    storeName: "阿明便當",
    lastUsedAt: null,
    items: [
      { id: randomUUID(), itemName: "雞腿飯", price: 90 },
      { id: randomUUID(), itemName: "排骨飯", price: 85 },
      { id: randomUUID(), itemName: "滷肉飯", price: 70 },
    ],
  },
];

export async function listTemplates(): Promise<StoreTemplate[]> {
  return [...templates].sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export async function getTemplate(id: string): Promise<StoreTemplate | undefined> {
  return templates.find((t) => t.id === id);
}

/**
 * 依店家名稱建立或更新樣板（同店家視為更新品項並刷新 lastUsedAt）。
 * 對應計劃文件「系統預設會將建立過的店家與菜單存為歷史樣板」的描述。
 */
export async function upsertTemplate(
  storeName: string,
  items: TemplateItemInput[]
): Promise<StoreTemplate> {
  const trimmedName = storeName.trim();
  const existing = templates.find((t) => t.storeName === trimmedName);
  const newItems: TemplateItem[] = items.map((i) => ({
    id: randomUUID(),
    itemName: i.itemName,
    price: i.price,
  }));

  if (existing) {
    existing.items = newItems;
    existing.lastUsedAt = new Date().toISOString();
    return existing;
  }

  const template: StoreTemplate = {
    id: randomUUID(),
    storeName: trimmedName,
    lastUsedAt: new Date().toISOString(),
    items: newItems,
  };
  templates.push(template);
  return template;
}
