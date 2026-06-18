"use client";

import { useActionState, useState } from "react";
import { updateTemplateAction } from "../actions";
import type { StoreTemplate } from "@/lib/data/storeTemplates";

type ItemRow = { key: string; itemName: string; price: string };

function makeKey() {
  return Math.random().toString(36).slice(2);
}

export default function TemplateEditForm({ template }: { template: StoreTemplate }) {
  const [state, formAction, pending] = useActionState(updateTemplateAction, undefined);
  const [storeName, setStoreName] = useState(template.storeName);
  const [items, setItems] = useState<ItemRow[]>(
    template.items.length > 0
      ? template.items.map((i) => ({ key: makeKey(), itemName: i.itemName, price: String(i.price) }))
      : [{ key: makeKey(), itemName: "", price: "" }]
  );

  function updateItem(key: string, field: "itemName" | "price", value: string) {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setItems((prev) => [...prev, { key: makeKey(), itemName: "", price: "" }]);
  }

  function removeRow(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
      <input type="hidden" name="id" value={template.id} />

      <div className="flex flex-col gap-1">
        <label htmlFor="storeName" className="text-sm font-medium">
          店家名稱
        </label>
        <input
          id="storeName"
          name="storeName"
          type="text"
          required
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="border rounded px-3 py-2 dark:bg-gray-800 dark:text-white dark:border-gray-600"
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">品項</p>
        {items.map((row, idx) => (
          <div key={row.key} className="flex gap-2 items-center">
            <input
              type="text"
              name="itemName"
              placeholder="品名"
              value={row.itemName}
              onChange={(e) => updateItem(row.key, "itemName", e.target.value)}
              className="flex-1 border rounded px-2 py-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
            <input
              type="number"
              name="itemPrice"
              placeholder="價格"
              min={0}
              value={row.price}
              onChange={(e) => updateItem(row.key, "price", e.target.value)}
              className="w-24 border rounded px-2 py-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              disabled={items.length === 1}
              className="text-sm text-red-600 underline disabled:opacity-30"
              aria-label={`移除第 ${idx + 1} 個品項`}
            >
              移除
            </button>
          </div>
        ))}
        <button
          id="add-template-item-row"
          type="button"
          onClick={addRow}
          className="self-start text-sm underline"
        >
          + 新增品項
        </button>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        id="update-template-submit"
        type="submit"
        disabled={pending}
        className="self-start bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {pending ? "儲存中..." : "儲存變更"}
      </button>
    </form>
  );
}
