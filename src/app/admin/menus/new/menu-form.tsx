"use client";

import { useActionState, useState } from "react";
import { createMenuAction } from "../actions";

type TemplateOption = {
  id: string;
  storeName: string;
  items: { itemName: string; price: number }[];
};

type ItemRow = { key: string; itemName: string; price: string };

function emptyRow(): ItemRow {
  return { key: crypto.randomUUID(), itemName: "", price: "" };
}

export default function MenuForm({ templates }: { templates: TemplateOption[] }) {
  const [state, formAction, pending] = useActionState(createMenuAction, undefined);
  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setStoreName(template.storeName);
    setItems(
      template.items.map((i) => ({
        key: crypto.randomUUID(),
        itemName: i.itemName,
        price: String(i.price),
      }))
    );
  }

  function updateItem(key: string, field: "itemName" | "price", value: string) {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setItems((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      {templates.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="templateSelect" className="text-sm font-medium">
            套用歷史樣板（選填）
          </label>
          <select
            id="templateSelect"
            value={selectedTemplateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">不使用樣板，手動輸入</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.storeName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="menuDate" className="text-sm font-medium">
            點餐日期
          </label>
          <input id="menuDate" name="menuDate" type="date" required className="border rounded px-3 py-2" />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="sessionName" className="text-sm font-medium">
            場次標籤（選填，如：午餐 / 午餐飲料）
          </label>
          <input id="sessionName" name="sessionName" type="text" className="border rounded px-3 py-2" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
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
            className="border rounded px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="cutoffTime" className="text-sm font-medium">
            收單截止時間
          </label>
          <input
            id="cutoffTime"
            name="cutoffTime"
            type="datetime-local"
            required
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 max-w-xs">
        <label htmlFor="reminderMinutesBefore" className="text-sm font-medium">
          截止前提醒推播（選填，分鐘）
        </label>
        <input
          id="reminderMinutesBefore"
          name="reminderMinutesBefore"
          type="number"
          min={0}
          placeholder="例如 30（留空表示不提醒）"
          className="border rounded px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">品項與價格</span>
        {items.map((row, index) => (
          <div key={row.key} className="flex gap-2 items-center">
            <input
              name="itemName"
              type="text"
              placeholder="品名"
              required
              value={row.itemName}
              onChange={(e) => updateItem(row.key, "itemName", e.target.value)}
              className="border rounded px-3 py-2 flex-1"
              aria-label={`品名-${index + 1}`}
            />
            <input
              name="itemPrice"
              type="number"
              min={0}
              placeholder="價格"
              required
              value={row.price}
              onChange={(e) => updateItem(row.key, "price", e.target.value)}
              className="border rounded px-3 py-2 w-28"
              aria-label={`價格-${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="text-sm text-red-600 underline"
            >
              移除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="self-start text-sm underline"
          id="add-item-row"
        >
          + 新增品項
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="saveAsTemplate" />
        將這個店家的品項存為歷史樣板（下次可一鍵套用）
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        id="create-menu-submit"
        type="submit"
        disabled={pending}
        className="self-start bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {pending ? "建立中..." : "建立菜單並發布"}
      </button>
    </form>
  );
}
