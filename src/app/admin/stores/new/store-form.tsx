"use client";

import { useActionState, useRef, useState } from "react";
import { createStoreAction } from "../actions";

type ItemRow = { key: string; itemName: string; price: string };
type AiStatus = "idle" | "loading" | "done" | "error";

function makeKey() {
  return Math.random().toString(36).slice(2);
}

export default function StoreNewForm() {
  const [state, formAction, pending] = useActionState(createStoreAction, undefined);
  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ key: makeKey(), itemName: "", price: "" }]);

  // AI 辨識相關狀態
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreviewItems, setAiPreviewItems] = useState<ItemRow[]>([]);
  const [aiPreviewStoreName, setAiPreviewStoreName] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateItem(key: string, field: "itemName" | "price", value: string) {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setItems((prev) => [...prev, { key: makeKey(), itemName: "", price: "" }]);
  }

  function removeRow(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
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
    setAiPreviewItems([]);
    setAiPreviewStoreName(null);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("/api/ai/parse-menu", { method: "POST", body: fd });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        items?: { itemName: string; price: number }[];
        storeName?: string | null;
      };

      if (!data.ok) {
        setAiStatus("error");
        setAiError(data.error ?? "辨識失敗，請重試");
        return;
      }

      setAiPreviewItems(
        (data.items ?? []).map((i) => ({
          key: makeKey(),
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
    setItems(aiPreviewItems.length > 0 ? aiPreviewItems : [{ key: makeKey(), itemName: "", price: "" }]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-lg">
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

      {/* 店家名稱 */}
      <div className="flex flex-col gap-1">
        <label htmlFor="storeName" className="text-sm font-medium">
          店家名稱
        </label>
        <input
          id="storeName"
          name="storeName"
          type="text"
          required
          placeholder="例如：阿明便當、50嵐"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          className="border rounded px-3 py-2 dark:bg-gray-800 dark:text-white dark:border-gray-600"
        />
      </div>

      {/* 品項 */}
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
          id="add-store-item-row"
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
        id="create-store-submit"
        type="submit"
        disabled={pending}
        className="self-start bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {pending ? "建立中..." : "建立店家"}
      </button>
    </form>
  );
}
