"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Menu } from "@/lib/data/menus";
import { batchDeleteMenusAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  open: "收單中",
  closed: "已結單",
  cancelled: "已取消",
};

export default function MenuListTable({ menus }: { menus: Menu[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const allSelected = menus.length > 0 && selected.size === menus.length;
  const someSelected = selected.size > 0 && selected.size < menus.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(menus.map((m) => m.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function doDelete(ids: string[], confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setDeleteError(null);
    startTransition(async () => {
      const fd = new FormData();
      for (const id of ids) fd.append("ids", id);
      const result = await batchDeleteMenusAction(fd);
      if (result?.error) {
        setDeleteError(`刪除失敗：${result.error}`);
      } else {
        setSelected(new Set());
      }
    });
  }

  function handleBatchDelete() {
    doDelete(
      Array.from(selected),
      `確定要刪除選取的 ${selected.size} 筆菜單紀錄？此操作無法復原。`
    );
  }

  function handleSingleDelete(menuId: string, label: string) {
    doDelete([menuId], `確定要刪除「${label}」的菜單紀錄？此操作無法復原。`);
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
            type="button"
            onClick={handleBatchDelete}
            disabled={pending}
            className="bg-red-600 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {pending ? "刪除中..." : `刪除選取（${selected.size} 筆）`}
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
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  checked={selected.has(menu.id)}
                  onChange={() => toggle(menu.id)}
                  className="cursor-pointer"
                />
              </td>
              <td className="py-2 pr-4">{menu.menuDate}</td>
              <td className="py-2 pr-4">{menu.sessionName ?? "-"}</td>
              <td className="py-2 pr-4">{menu.storeName}</td>
              <td className="py-2 pr-4">{menu.items.length}</td>
              <td className="py-2 pr-4">{STATUS_LABEL[menu.status] ?? menu.status}</td>
              <td className="py-2 pr-4 flex gap-3">
                <Link href={`/admin/menus/${menu.id}`} className="text-sm underline">
                  查看
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    handleSingleDelete(menu.id, `${menu.menuDate} ${menu.storeName}`)
                  }
                  className="text-sm text-red-600 underline disabled:opacity-50"
                >
                  刪除
                </button>
              </td>
            </tr>
          ))}
          {menus.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-gray-500 dark:text-gray-400">
                沒有符合的菜單紀錄。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
