"use client";

import { useActionState, useRef, useState } from "react";
import { createMenuAction } from "../actions";

type TemplateOption = {
  id: string;
  storeName: string;
  items: { itemName: string; price: number }[];
};

type ItemRow = { key: string; itemName: string; price: string };

type AiStatus = "idle" | "loading" | "done" | "error";

function emptyRow(): ItemRow {
  return { key: crypto.randomUUID(), itemName: "", price: "" };
}

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function MenuForm({ templates }: { templates: TemplateOption[] }) {
  const [state, formAction, pending] = useActionState(createMenuAction, undefined);
  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState<ItemRow[]>([emptyRow()]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // AI 辨識相關狀態
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiImportId, setAiImportId] = useState<string | null>(null);
  const [aiPreviewItems, setAiPreviewItems] = useState<ItemRow[]>([]);
  const [aiPreviewStoreName, setAiPreviewStoreName] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function updateAiItem(key: string, field: "itemName" | "price", value: string) {
    setAiPreviewItems((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  }

  function removeAiItem(key: string) {
    setAiPreviewItems((prev) =>
      prev.length > 1 ? prev.filter((row) => row.key !== key) : prev
    );
  }

  async function analyzeImage() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setAiStatus("loading");
    setAiError(null);
    setAiImportId(null);
    setAiPreviewItems([]);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("/api/ai/parse-menu", { method: "POST", body: fd });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        importId?: string;
        items?: { itemName: string; price: number }[];
        storeName?: string | null;
      };

      if (data.importId) setAiImportId(data.importId);

      if (!data.ok) {
        setAiStatus("error");
        setAiError(data.error ?? "辨識失敗，請重試");
        return;
      }

      setAiPreviewItems(
        (data.items ?? []).map((i) => ({
          key: crypto.randomUUID(),
          itemName: i.itemName,
          price: String(i.price),
        }))
      );
      setAiPreviewStoreName(data.storeName ?? null);
      setAiStatus("done");
    } catch {
      setAiStatus("error");
      setAiError("網路錯誤，請重試");
    }
  }

  function applyAiResult() {
    if (aiPreviewStoreName) setStoreName(aiPreviewStoreName);
    setItems(aiPreviewItems.length > 0 ? aiPreviewItems : [emptyRow()]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      {/* AI 辨識區塊 */}
      <details className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-100 dark:bg-gray-800">
        <summary className="cursor-pointer text-sm font-medium select-none">
          📷 AI 辨識菜單（選填）—— 上傳菜單圖片，自動提取品項與價格
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              ref={fileInputRef}
              id="ai-image-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="text-sm"
              onChange={(e) => {
                setSelectedFileName(e.target.files?.[0]?.name ?? null);
                setAiStatus("idle");
                setAiError(null);
                setAiImportId(null);
                setAiPreviewItems([]);
                setAiPreviewStoreName(null);
              }}
            />
            <button
              type="button"
              id="ai-analyze-button"
              disabled={!selectedFileName || aiStatus === "loading"}
              onClick={analyzeImage}
              className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {aiStatus === "loading" ? "辨識中..." : "開始辨識"}
            </button>
          </div>

          {aiStatus === "error" && aiError && (
            <p role="alert" className="text-sm text-red-600">
              ⚠️ {aiError}
              <span className="ml-2 text-gray-500">（可直接在下方手動輸入）</span>
            </p>
          )}

          {aiStatus === "done" && aiPreviewItems.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-green-700 dark:text-green-400">
                ✅ 辨識完成，共 {aiPreviewItems.length} 個品項
                {aiPreviewStoreName ? `，店家：${aiPreviewStoreName}` : ""}
                。可在此校對後點「套用辨識結果」。
              </p>
              <div className="flex flex-col gap-1" id="ai-preview-items">
                {aiPreviewItems.map((row) => (
                  <div key={row.key} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={row.itemName}
                      onChange={(e) => updateAiItem(row.key, "itemName", e.target.value)}
                      className="border rounded px-2 py-1 text-sm flex-1"
                      aria-label="AI 辨識品名"
                    />
                    <input
                      type="number"
                      min={0}
                      value={row.price}
                      onChange={(e) => updateAiItem(row.key, "price", e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-24"
                      aria-label="AI 辨識價格"
                    />
                    <button
                      type="button"
                      onClick={() => removeAiItem(row.key)}
                      className="text-xs text-red-600 underline"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                id="ai-apply-button"
                onClick={applyAiResult}
                className="self-start bg-green-600 text-white rounded px-3 py-1.5 text-sm"
              >
                套用辨識結果 →
              </button>
            </div>
          )}
        </div>
      </details>

      {/* 歷史樣板 */}
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
          <input
            id="menuDate"
            name="menuDate"
            type="date"
            required
            defaultValue={todayStr()}
            className="border rounded px-3 py-2"
          />
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
            defaultValue={`${todayStr()}T11:30`}
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

      {/* AI import ID 隱藏欄位，供 Server Action 建立菜單後回寫 menu_id */}
      {aiImportId && <input type="hidden" name="aiImportId" value={aiImportId} />}

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
