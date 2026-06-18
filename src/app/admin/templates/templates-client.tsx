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

  const allIds = templates.map((t) => t.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSingleDelete(id: string, storeName: string) {
    if (!confirm(`確定刪除樣板「${storeName}」？`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const result = await deleteTemplateAction(fd);
      if (result.error) {
        alert(`刪除失敗：${result.error}`);
      } else {
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        router.refresh();
      }
    });
  }

  function handleBatchDelete() {
    if (selected.size === 0) return;
    if (!confirm(`確定刪除選取的 ${selected.size} 個樣板？`)) return;
    startTransition(async () => {
      const fd = new FormData();
      selected.forEach((id) => fd.append("ids", id));
      const result = await batchDeleteTemplatesAction(fd);
      if (result.error) {
        alert(`批次刪除失敗：${result.error}`);
      } else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  if (templates.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400">
        目前沒有任何歷史樣板。新增菜單並勾選「存為樣板」後，店家資料會自動出現在這裡。
      </p>
    );
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            已選取 {selected.size} 個
          </span>
          <button
            id="batch-delete-templates-submit"
            type="button"
            disabled={isPending}
            onClick={handleBatchDelete}
            className="text-sm text-red-600 underline disabled:opacity-50"
          >
            {isPending ? "刪除中..." : "批次刪除"}
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
                onChange={toggleAll}
                className="cursor-pointer"
                aria-label="全選"
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
                  onChange={() => toggleOne(tmpl.id)}
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
                <Link
                  href={`/admin/templates/${tmpl.id}`}
                  className="text-sm underline"
                >
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
    </div>
  );
}
