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

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-3 w-8">
              <input
                type="checkbox"
                id="select-all-stores"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                aria-label="全選"
                className="cursor-pointer"
              />
            </th>
            <th className="py-2 pr-4">店家名稱</th>
            <th className="py-2 pr-4">品項數</th>
            <th className="py-2 pr-4">最近使用</th>
            <th className="py-2 pr-4">操作</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => (
            <tr key={store.id} className="border-b">
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  checked={selected.has(store.id)}
                  onChange={() => toggle(store.id)}
                  className="cursor-pointer"
                  aria-label={`選取 ${store.storeName}`}
                />
              </td>
              <td className="py-2 pr-4">{store.storeName}</td>
              <td className="py-2 pr-4">{store.items.length}</td>
              <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                {store.lastUsedAt
                  ? new Date(store.lastUsedAt).toLocaleDateString("zh-TW")
                  : "-"}
              </td>
              <td className="py-2 pr-4 flex gap-3">
                <Link href={`/admin/stores/${store.id}`} className="text-sm underline">
                  編輯
                </Link>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSingleDelete(store.id, store.storeName)}
                  className="text-sm text-red-600 underline disabled:opacity-50"
                >
                  刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
