import Link from "next/link";
import { listMenus } from "@/lib/data/menus";
import DeleteMenuButton from "./delete-menu-button";

const STATUS_LABEL: Record<string, string> = {
  open: "收單中",
  closed: "已結單",
  cancelled: "已取消",
};

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
        <p className="text-sm text-gray-500 mb-3">
          顯示最近 30 天的紀錄（共 {menus.length} 筆）
        </p>
      )}

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">日期</th>
            <th className="py-2 pr-4">場次</th>
            <th className="py-2 pr-4">店家</th>
            <th className="py-2 pr-4">品項數</th>
            <th className="py-2 pr-4">狀態</th>
            <th className="py-2 pr-4">操作</th>
          </tr>
        </thead>
        <tbody>
          {menus.map((menu) => (
            <tr key={menu.id} className="border-b">
              <td className="py-2 pr-4">{menu.menuDate}</td>
              <td className="py-2 pr-4">{menu.sessionName ?? "-"}</td>
              <td className="py-2 pr-4">{menu.storeName}</td>
              <td className="py-2 pr-4">{menu.items.length}</td>
              <td className="py-2 pr-4">{STATUS_LABEL[menu.status] ?? menu.status}</td>
              <td className="py-2 pr-4 flex gap-3">
                <Link href={`/admin/menus/${menu.id}`} className="text-sm underline">
                  查看
                </Link>
                <DeleteMenuButton
                  menuId={menu.id}
                  label={`${menu.menuDate} ${menu.storeName}`}
                />
              </td>
            </tr>
          ))}
          {menus.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-gray-500">
                {showAll
                  ? "目前還沒有任何菜單，請點右上角「新增菜單」建立第一張。"
                  : "最近 30 天沒有菜單紀錄。"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 text-sm">
        {showAll ? (
          <Link href="/admin/menus" className="underline text-gray-500">
            ← 只顯示最近 30 天
          </Link>
        ) : (
          <Link href="/admin/menus?all=1" className="underline text-gray-500">
            顯示更早的紀錄 →
          </Link>
        )}
      </div>
    </div>
  );
}
