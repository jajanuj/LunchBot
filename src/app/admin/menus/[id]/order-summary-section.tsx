"use client";

import { useActionState } from "react";
import { pushOrderSummaryAction } from "../actions";

export type StoreSummaryRow = {
  menuItemId: string;
  itemName: string;
  price: number;
  totalQuantity: number;
  totalAmount: number;
};

export type BillingRow = {
  employeeId: string;
  employeeName: string;
  items: { menuItemId: string; itemName: string; price: number; quantity: number }[];
  totalAmount: number;
};

export default function OrderSummarySection({
  menuId,
  storeName,
  menuDate,
  storeSummary,
  billingRows,
}: {
  menuId: string;
  storeName: string;
  menuDate: string;
  storeSummary: StoreSummaryRow[];
  billingRows: BillingRow[];
}) {
  const [pushState, pushFormAction, pushPending] = useActionState(pushOrderSummaryAction, undefined);

  const totalQty = storeSummary.reduce((s, r) => s + r.totalQuantity, 0);
  // 叫貨清單合計：依菜單當前單價計算（給店家的金額）
  const storeTotalAmt = storeSummary.reduce((s, r) => s + r.totalAmount, 0);
  // 個人對帳合計：依下單時儲存的金額加總（員工實際應扣款）
  const billingTotalAmt = billingRows.reduce((s, b) => s + b.totalAmount, 0);

  function exportCsv() {
    const rows: string[] = ["員工姓名,品項,數量,單價,小計,員工小計"];
    for (const bill of billingRows) {
      bill.items.forEach((item, idx) => {
        rows.push(
          [
            bill.employeeName,
            item.itemName,
            item.quantity,
            item.price,
            item.price * item.quantity,
            idx === 0 ? bill.totalAmount : "",
          ]
            .map((v) => `"${v}"`)
            .join(",")
        );
      });
    }
    rows.push(`"合計","","${totalQty}","","${billingTotalAmt}",""`);

    const bom = "﻿"; // Excel 開啟 UTF-8 CSV 需要 BOM
    const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `對帳清單_${storeName}_${menuDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (storeSummary.length === 0) {
    return (
      <div className="border rounded p-4 mb-4 text-sm text-gray-500 dark:text-gray-400">
        目前沒有任何有效訂單，叫貨清單尚無資料。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mb-4">
      {/* 店家叫貨清單 */}
      <details id="store-order-summary" className="border rounded p-4">
        <summary className="cursor-pointer font-medium">
          店家叫貨清單（共 {totalQty} 份，合計 ${storeTotalAmt}）
        </summary>
        <table className="w-full border-collapse text-left mt-3">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4">品名</th>
              <th className="py-2 pr-4">單價</th>
              <th className="py-2 pr-4">數量</th>
              <th className="py-2 pr-4">小計</th>
            </tr>
          </thead>
          <tbody>
            {storeSummary.map((row) => (
              <tr key={row.menuItemId} className="border-b">
                <td className="py-2 pr-4">{row.itemName}</td>
                <td className="py-2 pr-4">${row.price}</td>
                <td className="py-2 pr-4">{row.totalQuantity}</td>
                <td className="py-2 pr-4">${row.totalAmount}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2 pr-4">合計</td>
              <td />
              <td className="py-2 pr-4">{totalQty}</td>
              <td className="py-2 pr-4">${storeTotalAmt}</td>
            </tr>
          </tbody>
        </table>

        <form action={pushFormAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="menuId" value={menuId} />
          <button
            id="push-order-summary-submit"
            type="submit"
            disabled={pushPending}
            className="self-start bg-[#06C755] text-white rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            {pushPending ? "推播中..." : "推播叫貨清單至 LINE 群組"}
          </button>
          {pushState?.error && (
            <p role="alert" className="text-sm text-red-600">{pushState.error}</p>
          )}
          {pushState?.success && (
            <p className="text-sm text-green-700">✅ 已推播叫貨清單</p>
          )}
        </form>
      </details>

      {/* 個人對帳清單 */}
      <details id="billing-summary" className="border rounded p-4">
        <summary className="cursor-pointer font-medium">
          個人對帳清單（{billingRows.length} 位）
        </summary>
        <table className="w-full border-collapse text-left mt-3">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4">員工</th>
              <th className="py-2 pr-4">品項</th>
              <th className="py-2 pr-4">數量</th>
              <th className="py-2 pr-4">小計</th>
            </tr>
          </thead>
          <tbody>
            {billingRows.map((bill) => (
              <>
                {bill.items.map((item, idx) => (
                  <tr key={`${bill.employeeId}-${item.menuItemId}`} className="border-b">
                    {idx === 0 && (
                      <td className="py-2 pr-4 font-medium align-top" rowSpan={bill.items.length + 1}>
                        {bill.employeeName}
                      </td>
                    )}
                    <td className="py-2 pr-4">{item.itemName}</td>
                    <td className="py-2 pr-4">{item.quantity}</td>
                    <td className="py-2 pr-4">${item.price * item.quantity}</td>
                  </tr>
                ))}
                <tr key={`${bill.employeeId}-subtotal`} className="border-b-2 bg-gray-50 dark:bg-gray-800/50">
                  <td className="py-1 pr-4 text-sm text-right text-gray-500 dark:text-gray-400" colSpan={2}>
                    小計
                  </td>
                  <td className="py-1 pr-4 text-sm font-semibold">${bill.totalAmount}</td>
                </tr>
              </>
            ))}
            <tr className="font-semibold border-t-2">
              <td className="py-2 pr-4">合計</td>
              <td />
              <td className="py-2 pr-4">{totalQty}</td>
              <td className="py-2 pr-4">${billingTotalAmt}</td>
            </tr>
          </tbody>
        </table>

        <button
          id="export-billing-csv"
          type="button"
          onClick={exportCsv}
          className="mt-3 self-start border rounded px-4 py-2 text-sm"
        >
          匯出對帳清單（CSV）
        </button>
      </details>
    </div>
  );
}
