"use client";

import { useActionState, useRef, useState } from "react";
import { bulkImportEmployeesAction } from "./actions";

export default function BulkImportForm() {
  const [state, formAction, pending] = useActionState(bulkImportEmployeesAction, undefined);
  const [namesText, setNamesText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setNamesText(text);
  }

  return (
    <details className="mb-6 border rounded p-4">
      <summary className="cursor-pointer font-medium">批次匯入員工（貼名單或上傳 CSV/TXT）</summary>

      <form action={formAction} className="flex flex-col gap-2 mt-3">
        <label htmlFor="namesText" className="text-sm text-gray-600 dark:text-gray-300">
          每行一個姓名（可直接從 Excel 貼上整欄，或用逗號分隔）
        </label>
        <textarea
          id="namesText"
          name="namesText"
          rows={5}
          value={namesText}
          onChange={(e) => setNamesText(e.target.value)}
          className="border rounded px-3 py-2 font-mono text-sm"
          placeholder={"王小明\n陳小華\n林小芳"}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="text-sm"
        />

        <button
          id="bulk-import-submit"
          type="submit"
          disabled={pending}
          className="self-start bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {pending ? "匯入中..." : "批次新增"}
        </button>

        {state && (
          <div id="bulk-import-result" className="text-sm mt-2">
            <p className="text-green-700">成功新增 {state.createdCount} 位</p>
            {state.skipped.length > 0 && (
              <div className="text-amber-700">
                <p>略過 {state.skipped.length} 位：</p>
                <ul className="list-disc pl-5">
                  {state.skipped.map((s, i) => (
                    <li key={i}>
                      {s.name}：{s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>
    </details>
  );
}
