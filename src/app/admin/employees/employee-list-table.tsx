"use client";

import { useState, useTransition } from "react";
import type { Employee } from "@/lib/data/employees";
import { deleteEmployeeAction, batchDeleteEmployeesAction } from "./actions";

export default function EmployeeListTable({ employees }: { employees: Employee[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const allSelected = employees.length > 0 && selected.size === employees.length;
  const someSelected = selected.size > 0 && selected.size < employees.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBatchDelete() {
    if (!confirm(`確定要刪除選取的 ${selected.size} 位員工？此操作無法復原。`)) return;
    setDeleteError(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const id of selected) fd.append("ids", id);
      const result = await batchDeleteEmployeesAction(fd);
      if (result?.error) {
        setDeleteError(`刪除失敗：${result.error}`);
      } else {
        setSelected(new Set());
      }
    });
  }

  function handleSingleDelete(id: string, name: string) {
    if (!confirm(`確定要刪除員工「${name}」？此操作無法復原。`)) return;
    setDeleteError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteEmployeeAction(fd);
    });
  }

  return (
    <>
      {deleteError && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          ⚠️ {deleteError}
        </p>
      )}

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <button
            id="batch-delete-employees-submit"
            type="button"
            onClick={handleBatchDelete}
            disabled={pending}
            className="bg-red-600 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {pending ? "刪除中..." : `刪除選取（${selected.size} 位）`}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-500 dark:text-gray-400 underline"
          >
            取消選取
          </button>
        </div>
      )}

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
                aria-label="全選"
                className="cursor-pointer"
              />
            </th>
            <th className="py-2 pr-4">姓名</th>
            <th className="py-2 pr-4">LINE 綁定狀態</th>
            <th className="py-2 pr-4">操作</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b">
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  checked={selected.has(employee.id)}
                  onChange={() => toggle(employee.id)}
                  className="cursor-pointer"
                />
              </td>
              <td className="py-2 pr-4">{employee.employeeName}</td>
              <td className="py-2 pr-4">
                {employee.boundAt ? (
                  <span className="text-green-700">已綁定</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">未綁定</span>
                )}
              </td>
              <td className="py-2 pr-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSingleDelete(employee.id, employee.employeeName)}
                  className="text-sm text-red-600 underline disabled:opacity-50"
                >
                  刪除
                </button>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-gray-500 dark:text-gray-400">
                目前沒有任何員工，請先新增。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
