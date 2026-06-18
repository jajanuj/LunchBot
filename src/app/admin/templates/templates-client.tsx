"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteTemplateAction, batchDeleteTemplatesAction } from "./actions";
import type { StoreTemplate } from "@/lib/data/storeTemplates";

export default function TemplatesClient({
  templates,
}: {
  templates: StoreTemplate[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const allSelected = templates.length > 0 && selected.size === templates.length;
  const someSelected = selected.size > 0 && selected.size < templates.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(templates.map((t) => t.id)));
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
      const fd = new FormData();
      if (isSingle) {
        fd.set("id", ids[0]);
        const result = await deleteTemplateAction(fd);
        if (result.error) {
          setDeleteError(`刪除失敗：${result.error}`);
        } else {
          setSelected((prev) => { const next = new Set(prev); next.delete(ids[0]); return next; });
          router.refresh();
        }
      } else {
        ids.forEach((id) => fd.append("ids", id));
        const result = await batchDeleteTemplatesAction(fd);
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
      `確定要刪除選取的 ${selected.size} 個樣板？此操作無法復原。`
    );
  }

  function handleSingleDelete(id: string, storeName: string) {
    doDelete([id], `確定要刪除樣板「${storeName}」？此操作無法復原。`, true);
  }

  if (templates.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400">
        目前沒有任何歷史樣板。新增菜單並勾選「存為樣板」後，店家資料會自動出現在這裡。
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
            id="batch-delete-templates-submit"
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
                id="select-all-templates"
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
          {templates.map((tmpl) => (
            <tr key={tmpl.id} className="border-b">
              <td className="py-2 pr-3">
                <input
                  type="checkbox"
                  checked={selected.has(tmpl.id)}
                  onChange={() => toggle(tmpl.id)}
                  className="cursor-pointer"
                  aria-label={`選取 ${tmpl.storeName}`}
                />
              </td>
              <td className="py-2 pr-4">{tmpl.storeName}</td>
              <td className="py-2 pr-4">{tmpl.items.length}</td>
              <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                {tmpl.lastUsedAt
                  ? new Date(tmpl.lastUsedAt).toLocaleDateString("zh-TW")
                  : "-"}
              </td>
              <td className="py-2 pr-4 flex gap-3">
                <Link href={`/admin/templates/${tmpl.id}`} className="text-sm underline">
                  編輯
                </Link>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSingleDelete(tmpl.id, tmpl.storeName)}
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
