# 開發進度 (Progress Log)

> 對應計劃文件：[docs/LunchBot-plan.md](LunchBot-plan.md)

---

## 目前狀態

- ✅ **已完成**
  - 專案骨架初始化：Next.js 16 (App Router) + TypeScript + Tailwind CSS + ESLint
  - 已設定 Git 版控（git init + 第一個 commit）
  - E2E 測試環境：Puppeteer，測試腳本 `e2e/smoke.test.mjs`（啟動 dev server → 開首頁 → 驗證渲染成功）
  - `npm run build` / `npm run lint` / `npm run test:e2e` 皆通過

- 🔄 **進行中**
  - （無）

- ⏳ **待處理（依 `docs/LunchBot-plan.md` 第 6 節 WBS 順序）**
  - 階段一：建立 Supabase 專案資料表 — 因 Supabase 專案尚未建立，先以 SQL migration 檔案（`supabase/migrations/`）的方式撰寫 schema，待老闆建立專案後再套用
  - 階段一：`employees` 員工名冊匯入機制
  - 階段一：Next.js 後台 店家/菜單 CRUD（手動輸入模式）
  - 階段一：歷史樣板載入與套用功能
  - 階段二、三、四：依 WBS 順序開發（LINE Bot/LIFF、AI 菜單辨識、結算與薪資扣款）

- ⚠️ **遇到的問題 / 已修正紀錄**
  - `create-next-app` 預設會產生 `CLAUDE.md`（內容為 `@AGENTS.md` 指向檔），Windows 檔案系統不分大小寫，與既有的 `claude.md` 專案規範檔是同一個檔案，搬移專案骨架時不慎覆蓋掉原內容。已立即發現並用對話中讀取過的原始內容還原，且移除了多餘的 `AGENTS.md`。**後續若再次 scaffold 專案或新增工具，需注意 Windows 環境下檔名大小寫衝突的風險。**
  - Supabase / LINE / Gemini 等外部服務目前皆尚未建立帳號或取得金鑰，相關任務會先以本機可獨立驗證的方式（如 SQL migration 檔案、Mock 資料）進行，待老闆提供實際憑證後再串接。

---

## 技術選型確認紀錄

| 項目 | 決定 | 確認時間 |
|---|---|---|
| 語言/樣式 | TypeScript + Tailwind CSS | 2026-06-16 |
| 套件管理工具 | npm | 2026-06-16 |
| E2E 測試工具 | Puppeteer | 2026-06-16 |
| Supabase 專案狀態 | 尚未建立，先寫 SQL migration 檔案 | 2026-06-16 |
