import Link from "next/link";
import { listMenus } from "@/lib/data/menus";

const STATUS_LABEL: Record<string, string> = {
  open: "收單中",
  closed: "已結單",
  cancelled: "已取消",
};

export default async function MenusPage() {
  const menus = await listMenus();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">菜單管理</h1>
        <Link href="/admin/menus/new" className="bg-black text-white rounded px-4 py-2">
          新增菜單
        </Link>
      </div>

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
              <td className="py-2 pr-4">
                <Link href={`/admin/menus/${menu.id}`} className="text-sm underline">
                  查看
                </Link>
              </td>
            </tr>
          ))}
          {menus.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-gray-500">
                目前還沒有任何菜單，請點右上角「新增菜單」建立第一張。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
