"use client";

import { useActionState, useState } from "react";
import { assistedUpsertOrderAction, assistedCancelOrderAction } from "../actions";

type Employee = { id: string; employeeName: string };
type MenuItem = { id: string; itemName: string; price: number };
type ExistingOrder = {
  employeeId: string;
  status: "pending" | "cancelled";
  source: "self" | "assisted";
  totalAmount: number;
  items: { menuItemId: string; quantity: number }[];
};

const STATUS_LABEL: Record<string, string> = { pending: "有效", cancelled: "已取消" };
const SOURCE_LABEL: Record<string, string> = { self: "員工自助", assisted: "助理代下" };

export default function AssistedOrderSection({
  menuId,
  employees,
  menuItems,
  existingOrders,
}: {
  menuId: string;
  employees: Employee[];
  menuItems: MenuItem[];
  existingOrders: ExistingOrder[];
}) {
  const [state, formAction, pending] = useActionState(assistedUpsertOrderAction, undefined);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function selectEmployee(employeeId: string) {
    setSelectedEmployeeId(employeeId);
    const existing = existingOrders.find((o) => o.employeeId === employeeId && o.status === "pending");
    const next: Record<string, number> = {};
    for (const item of menuItems) {
      next[item.id] = existing?.items.find((i) => i.menuItemId === item.id)?.quantity ?? 0;
    }
    setQuantities(next);
  }

  return (
    <details id="assisted-order-details" className="border rounded p-4 mb-4">
      <summary className="cursor-pointer font-medium">助理代客新增/修改訂單</summary>

      <form action={formAction} className="flex flex-col gap-3 mt-3 max-w-md">
        <input type="hidden" name="menuId" value={menuId} />

        <div className="flex flex-col gap-1">
          <label htmlFor="assisted-employee-select" className="text-sm font-medium">
            選擇員工
          </label>
          <select
            id="assisted-employee-select"
            name="employeeId"
            value={selectedEmployeeId}
            onChange={(e) => selectEmployee(e.target.value)}
            className="border rounded px-3 py-2 dark:bg-gray-800 dark:text-white dark:border-gray-600"
          >
            <option value="">請選擇</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeName}
              </option>
            ))}
          </select>
        </div>

        {menuItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input type="hidden" name="menuItemId" value={item.id} />
            <span className="flex-1">
              {item.itemName}（${item.price}）
            </span>
            <input
              type="number"
              name="quantity"
              min={0}
              value={quantities[item.id] ?? 0}
              onChange={(e) =>
                setQuantities((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
              }
              className="border rounded px-2 py-1 w-20 dark:bg-gray-800 dark:text-white dark:border-gray-600"
              aria-label={`${item.itemName} 數量`}
            />
          </div>
        ))}

        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state?.success && <p className="text-sm text-green-700">✅ 已更新該員工的訂單</p>}

        <button
          id="assisted-order-submit"
          type="submit"
          disabled={pending || !selectedEmployeeId}
          className="self-start bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {pending ? "送出中..." : "送出/更新訂單"}
        </button>
      </form>

      <table id="assisted-orders-table" className="w-full border-collapse text-left mt-4">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">員工</th>
            <th className="py-2 pr-4">金額</th>
            <th className="py-2 pr-4">狀態</th>
            <th className="py-2 pr-4">來源</th>
            <th className="py-2 pr-4">操作</th>
          </tr>
        </thead>
        <tbody>
          {existingOrders.map((order) => {
            const employee = employees.find((e) => e.id === order.employeeId);
            return (
              <tr key={order.employeeId} className="border-b">
                <td className="py-2 pr-4">{employee?.employeeName ?? order.employeeId}</td>
                <td className="py-2 pr-4">${order.totalAmount}</td>
                <td className="py-2 pr-4">{STATUS_LABEL[order.status] ?? order.status}</td>
                <td className="py-2 pr-4">{SOURCE_LABEL[order.source] ?? order.source}</td>
                <td className="py-2 pr-4">
                  {order.status === "pending" && (
                    <form action={assistedCancelOrderAction}>
                      <input type="hidden" name="menuId" value={menuId} />
                      <input type="hidden" name="employeeId" value={order.employeeId} />
                      <button type="submit" className="text-sm text-red-600 underline">
                        取消
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
          {existingOrders.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-gray-500 dark:text-gray-400">
                目前還沒有人下單。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </details>
  );
}
