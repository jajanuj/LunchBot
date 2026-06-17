import { notFound } from "next/navigation";
import { getMenu } from "@/lib/data/menus";
import { listEmployees } from "@/lib/data/employees";
import { listOrdersByMenu } from "@/lib/data/orders";
import { closeMenuAction, deleteMenuAction } from "../actions";
import PushNotificationButton from "./push-notification-button";
import AssistedOrderSection from "./assisted-order-section";

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

  const [employees, orders] = await Promise.all([listEmployees(), listOrdersByMenu(id)]);

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
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <p className="text-sm text-gray-600 mb-1">點餐連結（可複製給員工或自行測試）：</p>
            <a
              href={`/liff/order?menuId=${menu.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 underline break-all"
            >
              /liff/order?menuId={menu.id}
            </a>
          </div>
          <PushNotificationButton menuId={menu.id} />
        </div>
      )}

      <AssistedOrderSection
        menuId={menu.id}
        employees={employees.map((e) => ({ id: e.id, employeeName: e.employeeName }))}
        menuItems={menu.items}
        existingOrders={orders.map((o) => ({
          employeeId: o.employeeId,
          status: o.status,
          source: o.source,
          totalAmount: o.totalAmount,
          items: o.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        }))}
      />

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
