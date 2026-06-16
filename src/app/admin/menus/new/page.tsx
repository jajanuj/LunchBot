import { listTemplates } from "@/lib/data/storeTemplates";
import MenuForm from "./menu-form";

export default async function NewMenuPage() {
  const templates = await listTemplates();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">新增菜單</h1>
      <MenuForm
        templates={templates.map((t) => ({
          id: t.id,
          storeName: t.storeName,
          items: t.items.map((i) => ({ itemName: i.itemName, price: i.price })),
        }))}
      />
    </div>
  );
}
