export const dynamic = "force-dynamic";

import { listTemplates } from "@/lib/data/storeTemplates";
import TemplatesClient from "./templates-client";

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">歷史店家樣板</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        新增菜單時可套用這裡的樣板自動帶入品項。點擊「編輯」可修改店家名稱與品項。
      </p>
      <TemplatesClient templates={templates} />
    </div>
  );
}
