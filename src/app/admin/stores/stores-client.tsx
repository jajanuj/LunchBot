"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteStoreAction, batchDeleteStoresAction } from "./actions";
import type { StoreTemplate } from "@/lib/data/storeTemplates";

export default function StoresClient({
  stores,
}: {
  stores: StoreTemplate[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const allSelected = stores.length > 0 && selected.size === stores.length;
  const someSelected = selected.size > 0 && selected.size < stores.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(stores.map((s) => s.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function doDelete(ids: string[], confirmMsg: string, isSingle = false) {
    if (!confirm(confirmMsg)) return;
    setDeleteError(null);
    startTransition(async () => {
      if (isSingle) {
        const fd = new FormData();
        fd.set("id", ids[0]);
        const result = await deleteStoreAction(fd);
        if (result.error) {
          setDeleteError(`刪除失敗：${result.error}`);
        } else {
          setSelected((prev) => { const next = new Set(prev); next.delete(ids[0]); return next; });
          router.refresh();
        }
      } else {
        const fd = new FormData();
        ids.forEach((id) => fd.append("ids", id));
        const result = await batchDeleteStoresAction(fd);
        if (result.error) {
          setDeleteError(`刪除失敗：${result.error}`);
        } else {
          setSelected(new Set());
          router.refresh();
        }
      }
    });
  }

  function handleBatchDelete() {
    doDelete(
      Array.from(selected),
      `確定要刪除選取的 ${selected.size} 個店家？此操作無法復原。`
    );
  }

  function handleSingleDelete(id: string, storeName: string) {
    doDelete([id], `確定要刪除店家「${storeName}」？此操作無法復原。`, true);
  }

  if (stores.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400">
        目前沒有任何店家紀錄。可點選右上角「新增店家」，或在建立菜單時勾選「同步儲存至店家管理」。
      </p>
    );
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
            id="batch-delete-stores-submit"
            type="button"
            onClick={handleBatchDelete}
            disabled={isPending}
            className="bg-red-600 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {isPending ? "刪除中..." : `刪除選取（${selected.size} 個）`}
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
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="select-all-stores"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected; }}
          onChange={toggleAll}
          aria-label="全選"
          className="cursor-pointer"
        />
        <span className="text-sm text-gray-500 dark:text-gray-400">全選</span>
      </div>

      {/* ── 卡片視圖（主要顯示）── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store) => (
          <div
            key={store.id}
            data-store-id={store.id}
            data-store-name={store.storeName}
            className="relative flex flex-col border rounded-xl p-4 dark:border-gray-700 dark:bg-gray-900 bg-white shadow-sm"
          >
            {/* 左上角 checkbox */}
            <input
              type="checkbox"
              checked={selected.has(store.id)}
              onChange={() => toggle(store.id)}
              aria-label={`選取 ${store.storeName}`}
              className="absolute top-3.5 left-3.5 cursor-pointer"
            />

            {/* 店家名稱 */}
            <div className="pl-7 mb-3">
              <p className="font-semibold text-base">{store.storeName}</p>
            </div>

            {/* 統計資訊 */}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4 pl-7">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <p className="text-xs text-gray-400 mb-0.5">品項數</p>
                <p className="font-semibold text-base">{store.items.length}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                <p className="text-xs text-gray-400 mb-0.5">最近使用</p>
                <p className="font-medium text-xs">
                  {store.lastUsedAt
                    ? new Date(store.lastUsedAt).toLocaleDateString("zh-TW")
                    : "-"}
                </p>
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-2 pt-3 border-t dark:border-gray-700 mt-auto">
              <Link
                href={`/admin/stores/${store.id}`}
                className="flex-1 text-center text-sm py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                編輯
              </Link>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSingleDelete(store.id, store.storeName)}
                className="text-sm text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── 列表視圖（隱藏，保留備用）── */}
      <div className="hidden" aria-hidden="true">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3 w-8" />
              <th className="py-2 pr-4">店家名稱</th>
              <th className="py-2 pr-4">品項數</th>
              <th className="py-2 pr-4">最近使用</th>
              <th className="py-2 pr-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.id} className="border-b">
                <td className="py-2 pr-3" />
                <td className="py-2 pr-4">{store.storeName}</td>
                <td className="py-2 pr-4">{store.items.length}</td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                  {store.lastUsedAt
                    ? new Date(store.lastUsedAt).toLocaleDateString("zh-TW")
                    : "-"}
                </td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/stores/${store.id}`} className="text-sm underline">
                    編輯
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
