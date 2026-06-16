import { notFound } from "next/navigation";
import { getMenu } from "@/lib/data/menus";
import { closeMenuAction, deleteMenuAction } from "../actions";
import PushNotificationButton from "./push-notification-button";

const STATUS_LABEL: Record<string, string> = {
  open: "收單中",
  closed: "已結單",
  cancelled: "已取消",
};

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const menu = await getMenu(id);

  if (!menu) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">
        {menu.menuDate} {menu.sessionName ? `（${menu.sessionName}）` : ""} - {menu.storeName}
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        狀態：{STATUS_LABEL[menu.status] ?? menu.status}　|　截止時間：
        {new Date(menu.cutoffTime).toLocaleString("zh-TW")}
        {menu.reminderMinutesBefore && (
          <>
            　|　提醒推播：截止前 {menu.reminderMinutesBefore} 分鐘
            {menu.reminderSentAt
              ? `（已於 ${new Date(menu.reminderSentAt).toLocaleString("zh-TW")} 發送）`
              : "（尚未發送）"}
          </>
        )}
      </p>

      <table className="w-full border-collapse text-left mb-6">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">品名</th>
            <th className="py-2 pr-4">價格</th>
          </tr>
        </thead>
        <tbody>
          {menu.items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2 pr-4">{item.itemName}</td>
              <td className="py-2 pr-4">{item.price}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {menu.status === "open" && (
        <div className="mb-4">
          <PushNotificationButton menuId={menu.id} />
        </div>
      )}

      <div className="flex gap-4">
        {menu.status === "open" && (
          <form action={closeMenuAction}>
            <input type="hidden" name="id" value={menu.id} />
            <button id="close-menu-submit" type="submit" className="bg-black text-white rounded px-4 py-2">
              結單
            </button>
          </form>
        )}
        <form action={deleteMenuAction}>
          <input type="hidden" name="id" value={menu.id} />
          <button id="delete-menu-submit" type="submit" className="text-sm text-red-600 underline">
            刪除這張菜單
          </button>
        </form>
      </div>
    </div>
  );
}
