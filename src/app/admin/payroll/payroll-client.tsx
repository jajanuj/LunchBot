"use client";

import { useActionState, useState } from "react";
import { generatePayrollAction, markExportedAction } from "./actions";
import type { PayrollEmployeeSummary, PayrollDeduction } from "@/lib/data/payrollDeductions";

type Props = {
  initialPeriod: string;
  initialSummary: PayrollEmployeeSummary[];
  initialDeductions: (PayrollDeduction & { employeeName: string })[];
};

function exportCsv(
  period: string,
  deductions: (PayrollDeduction & { employeeName: string })[]
) {
  const BOM = "﻿";
  const header = "帳期,員工姓名,訂單金額,狀態\n";
  const rows = deductions
    .map((d) => `${d.billingPeriod},${d.employeeName},${d.amount},${d.status === "pending" ? "未結" : "已匯出"}`)
    .join("\n");
  const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PayrollClient({ initialPeriod, initialSummary, initialDeductions }: Props) {
  const [period, setPeriod] = useState(initialPeriod);
  const [summary, setSummary] = useState(initialSummary);
  const [deductions, setDeductions] = useState(initialDeductions);

  const [genState, genAction, genPending] = useActionState(
    async (_: unknown, formData: FormData) => {
      const res = await generatePayrollAction(formData);
      if (!res.error) {
        // 重新載入資料
        const r = await fetch(`/admin/payroll/api?period=${formData.get("billingPeriod")}`);
        if (r.ok) {
          const data = await r.json();
          setSummary(data.summary);
          setDeductions(data.deductions);
          setPeriod(formData.get("billingPeriod") as string);
        }
      }
      return res;
    },
    null
  );

  const [markState, markAction, markPending] = useActionState(
    async (_: unknown, formData: FormData) => {
      const res = await markExportedAction(formData);
      if (!res.error) {
        const r = await fetch(`/admin/payroll/api?period=${formData.get("billingPeriod")}`);
        if (r.ok) {
          const data = await r.json();
          setSummary(data.summary);
          setDeductions(data.deductions);
        }
      }
      return res;
    },
    null
  );

  const totalAmount = summary.reduce((acc, s) => acc + s.totalAmount, 0);
  const hasPending = summary.some((s) => s.status === "pending");

  return (
    <div className="max-w-3xl space-y-8">
      {/* 帳期選擇 + 產生扣款 */}
      <section className="border rounded p-4">
        <h2 className="font-semibold mb-3">選擇帳期</h2>
        <form action={genAction} className="flex gap-3 items-end">
          <div>
            <label htmlFor="billingPeriod" className="block text-sm mb-1">帳期（YYYY-MM）</label>
            <input
              id="billingPeriod"
              name="billingPeriod"
              type="month"
              defaultValue={period}
              required
              className="border rounded px-3 py-2 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>
          <button
            id="generate-payroll-submit"
            type="submit"
            disabled={genPending}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {genPending ? "產生中..." : "產生 / 更新扣款紀錄"}
          </button>
        </form>
        {genState?.error && <p className="mt-2 text-red-600">{genState.error}</p>}
        {genState?.inserted !== undefined && (
          <p className="mt-2 text-green-700">已新增 {genState.inserted} 筆扣款紀錄。</p>
        )}
      </section>

      {/* 員工扣款彙整 */}
      {summary.length > 0 && (
        <section className="border rounded p-4">
          <h2 className="font-semibold mb-3">員工扣款彙整（{period}）</h2>
          <table id="payroll-summary-table" className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                <th className="text-left py-2 px-3">員工</th>
                <th className="text-right py-2 px-3">訂單數</th>
                <th className="text-right py-2 px-3">合計金額</th>
                <th className="text-center py-2 px-3">狀態</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.employeeId} className="border-b">
                  <td className="py-2 px-3">{s.employeeName}</td>
                  <td className="text-right py-2 px-3">{s.orderCount}</td>
                  <td className="text-right py-2 px-3">${s.totalAmount}</td>
                  <td className="text-center py-2 px-3">
                    <span className={s.status === "exported" ? "text-gray-500" : "text-orange-600"}>
                      {s.status === "exported" ? "已匯出" : "未結"}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="font-semibold bg-gray-50 dark:bg-gray-800">
                <td className="py-2 px-3">合計</td>
                <td className="text-right py-2 px-3">
                  {summary.reduce((acc, s) => acc + s.orderCount, 0)}
                </td>
                <td className="text-right py-2 px-3">${totalAmount}</td>
                <td />
              </tr>
            </tbody>
          </table>

          <div className="flex gap-3 mt-4">
            <button
              id="export-payroll-csv"
              type="button"
              onClick={() => exportCsv(period, deductions)}
              className="border px-4 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              匯出 CSV
            </button>

            {hasPending && (
              <form action={markAction}>
                <input type="hidden" name="billingPeriod" value={period} />
                <button
                  id="mark-payroll-exported-submit"
                  type="submit"
                  disabled={markPending}
                  className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 disabled:opacity-50"
                >
                  {markPending ? "標記中..." : "標記為已匯出"}
                </button>
              </form>
            )}
          </div>
          {markState?.error && <p className="mt-2 text-red-600">{markState.error}</p>}
          {markState?.updated !== undefined && (
            <p className="mt-2 text-green-700">已將 {markState.updated} 筆紀錄標記為已匯出。</p>
          )}
        </section>
      )}

      {summary.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">
          此帳期尚無扣款紀錄。請先點選「產生 / 更新扣款紀錄」。
        </p>
      )}
    </div>
  );
}
