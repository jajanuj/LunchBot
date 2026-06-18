export const dynamic = "force-dynamic";

import Link from "next/link";
import { listTemplates } from "@/lib/data/storeTemplates";
import StoresClient from "./stores-client";

export default async function StoresPage() {
  const stores = await listTemplates();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">店家管理</h1>
        <Link
          href="/admin/stores/new"
          className="bg-black text-white rounded px-3 py-1.5 text-sm hover:bg-gray-800"
        >
          + 新增店家
        </Link>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        管理常用店家的品項資料。新增菜單時可套用店家資料自動帶入品項與價格。
      </p>
      <StoresClient stores={stores} />
    </div>
  );
}
