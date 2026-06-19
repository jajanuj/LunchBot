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

const STATUS_STYLE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

function formatCutoff(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

      {/* 批次操作列 */}
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

      {/* 全選列 */}
      {menus.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
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
          <span className="text-sm text-gray-500 dark:text-gray-400">全選</span>
        </div>
      )}

      {/* ── 卡片視圖（主要顯示）── */}
      {menus.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 py-4">沒有符合的菜單紀錄。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menus.map((menu) => (
            <div
              key={menu.id}
              data-menu-id={menu.id}
              data-menu-store={menu.storeName}
              className="relative flex flex-col border rounded-xl p-4 dark:border-gray-700 dark:bg-gray-900 bg-white shadow-sm"
            >
              {/* 左上角 checkbox */}
              <input
                type="checkbox"
                checked={selected.has(menu.id)}
                onChange={() => toggle(menu.id)}
                aria-label={`選取 ${menu.storeName}`}
                className="absolute top-3.5 left-3.5 cursor-pointer"
              />

              {/* 標題列 */}
              <div className="flex items-start justify-between mb-3 pl-7">
                <div className="min-w-0">
                  <p className="font-semibold text-base truncate">{menu.storeName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {menu.menuDate}
                    {menu.sessionName ? ` · ${menu.sessionName}` : ""}
                  </p>
                </div>
                <span
                  className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[menu.status] ?? STATUS_STYLE.closed}`}
                >
                  {STATUS_LABEL[menu.status] ?? menu.status}
                </span>
              </div>

              {/* 統計資訊 */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4 pl-7">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-xs text-gray-400 mb-0.5">品項數</p>
                  <p className="font-semibold text-base">{menu.items.length}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <p className="text-xs text-gray-400 mb-0.5">截止時間</p>
                  <p className="font-medium text-xs">{formatCutoff(menu.cutoffTime)}</p>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-2 pt-3 border-t dark:border-gray-700 mt-auto">
                <Link
                  href={`/admin/menus/${menu.id}`}
                  className="flex-1 text-center text-sm py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  查看詳細
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSingleDelete(menu.id, `${menu.menuDate} ${menu.storeName}`)}
                  className="text-sm text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 列表視圖（隱藏，保留備用）── */}
      <div className="hidden" aria-hidden="true">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3 w-8" />
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
                <td className="py-2 pr-3" />
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
          </tbody>
        </table>
      </div>
    </>
  );
}
