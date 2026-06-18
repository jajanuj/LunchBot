import Link from "next/link";
import { listMenus } from "@/lib/data/menus";
import MenuListTable from "./menu-list-table";

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function MenusPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";
  const since = showAll ? undefined : daysAgoStr(30);
  const menus = await listMenus(since);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">菜單管理</h1>
        <Link href="/admin/menus/new" className="bg-black text-white rounded px-4 py-2">
          新增菜單
        </Link>
      </div>

      {!showAll && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          顯示最近 30 天的紀錄（共 {menus.length} 筆）
        </p>
      )}

      <MenuListTable menus={menus} />

      <div className="mt-4 text-sm">
        {showAll ? (
          <Link href="/admin/menus" className="underline text-gray-500 dark:text-gray-400">
            ← 只顯示最近 30 天
          </Link>
        ) : (
          <Link href="/admin/menus?all=1" className="underline text-gray-500 dark:text-gray-400">
            顯示更早的紀錄 →
          </Link>
        )}
      </div>
    </div>
  );
}
