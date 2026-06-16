# 開發進度 (Progress Log)

> 對應計劃文件：[docs/LunchBot-plan.md](LunchBot-plan.md)

---

## 目前狀態

- ✅ **已完成**
  - 專案骨架初始化：Next.js 16 (App Router) + TypeScript + Tailwind CSS + ESLint
  - 已設定 Git 版控（git init + commits）
  - **WBS 階段一（核心資料庫與點餐後台）全部完成：**
    - E2E 測試環境：Puppeteer，`e2e/smoke.test.mjs`、`e2e/login.test.mjs`（4 情境）、`e2e/employees.test.mjs`（4 情境）、`e2e/employees-bulk-import.test.mjs`（批次匯入）、`e2e/menus.test.mjs`（4 情境），共用工具 `e2e/utils.mjs`
    - 後台登入機制：mock 帳號（scrypt 雜湊）+ HMAC 簽章 session cookie + Next.js 16 `proxy.ts`（樂觀導向）+ DAL `verifySession()`（安全檢查），介面設計成之後可直接換成 Supabase Auth
    - 員工名冊管理：`/admin/employees`，手動新增（防重複）/ 批次匯入（貼名單或上傳 .csv/.txt，回報成功/略過摘要）/ 列表（含 LINE 綁定狀態）/ 刪除
    - 菜單管理：`/admin/menus`，手動輸入（動態品項列）+ 歷史樣板套用（自動帶入店家/品項，可同步存為新樣板）+ 結單/刪除
    - 上述 employees / menus / storeTemplates 三個資料層皆先用記憶體陣列頂著，介面設計成之後可直接換成 Supabase 查詢
  - `npm run build` / `npm run lint` / `npm run test:e2e`（共 18 個情境）皆通過

- 🔄 **進行中**
  - Supabase 資料庫 schema — `supabase/migrations/0001_init_schema.sql`、`0002_rls_policies.sql` 已依計劃文件第 4 節寫好（9 張表 + RLS），但因 Supabase 專案尚未建立、本機也沒有 psql/docker，**無法實際套用驗證**。待老闆建立 Supabase 專案、提供 Project URL / anon key / service_role key 後即可套用並驗證

- ⏳ **待處理**
  - WBS 階段二（LINE Bot / LIFF）、階段三（Gemini AI 菜單辨識）：需要老闆先申請 LINE Developers（Channel Access Token/Secret、LIFF ID）與 Google Gemini API Key，這兩塊無法用 mock 完整模擬（LIFF 本質要在真實 LINE App / 真實 LIFF ID 下才能驗證），待老闆處理好外部帳號後再開工
  - WBS 階段四（結算彙整與薪資扣款）
  - 階段一所有 mock 資料層（employees / menus / storeTemplates）最終都要換成真正的 Supabase 查詢，待 Supabase 專案建立後一起處理

- ⚠️ **遇到的問題 / 已修正紀錄**
  - `create-next-app` 預設會產生 `CLAUDE.md`（內容為 `@AGENTS.md` 指向檔），Windows 檔案系統不分大小寫，與既有的 `claude.md` 專案規範檔是同一個檔案，搬移專案骨架時不慎覆蓋掉原內容。已立即發現並用對話中讀取過的原始內容還原，且移除了多餘的 `AGENTS.md`。**後續若再次 scaffold 專案或新增工具，需注意 Windows 環境下檔名大小寫衝突的風險。**
  - Supabase / LINE / Gemini 等外部服務目前皆尚未建立帳號或取得金鑰，相關任務會先以本機可獨立驗證的方式（如 SQL migration 檔案、Mock 資料）進行，待老闆提供實際憑證後再串接。
  - Next.js 16 把 `middleware.ts` 改名為 `proxy.ts`（功能相同），開發前先查了 `node_modules/next/dist/docs` 才確認，避免寫了舊版檔名導致保護機制悄悄失效。
  - E2E 測試一開始用 `child.kill()` 關閉 `next dev`，在 Windows 上因為 `shell:true` 啟動的是 cmd.exe → npx → node 的程序樹，只會砍掉最外層 cmd.exe，底層 next dev server 變成孤兒程序、一路佔用 port 並持續吃記憶體（曾累積到 4 個殘留 process）。已改用 `taskkill /PID <pid> /T /F` 砍整個程序樹並清掉殘留 process，修正後 `e2e/utils.mjs` 統一處理。
  - 員工名冊 E2E 測試一開始用籤略的 `button[type="submit"]` 選擇器，在同時有「登出」按鈕與表單按鈕的頁面上點錯按鈕；後續測試斷言也誤判過殘留的錯誤訊息文字。兩個都已修正（詳見 commit b4908a3），**之後新增頁面上有多個 submit 按鈕時，務必加明確 id，不要用籤略選擇器**。
  - 菜單表單的 `date` / `datetime-local` 輸入框用 Puppeteer `page.type()` 不可靠（這類輸入框是多段式編輯，不是單純文字輸入）。改用 `page.evaluate()` 直接設定 DOM `value` 並補發 `input`/`change` 事件，才能讓 React 的 controlled/uncontrolled 欄位都正確收到值。

---

## 技術選型確認紀錄

| 項目 | 決定 | 確認時間 |
|---|---|---|
| 語言/樣式 | TypeScript + Tailwind CSS | 2026-06-16 |
| 套件管理工具 | npm | 2026-06-16 |
| E2E 測試工具 | Puppeteer | 2026-06-16 |
| Supabase 專案狀態 | 尚未建立，先寫 SQL migration 檔案 | 2026-06-16 |
| Supabase RLS 架構 | 前端不直接連 Supabase，一律經由 Next.js API Route + service_role key；anon/authenticated 角色預設拒絕所有存取（待老闆確認，詳見 `supabase/migrations/0002_rls_policies.sql` 註解） | 2026-06-16 |
| 後台登入機制 | 完整帳號系統（每位助理獨立帳號），但因 Supabase 尚未建立先用 mock 帳號頂著，介面設計成之後可直接換成 Supabase Auth | 2026-06-16 |
| 菜單管理範圍 | 手動輸入 + 歷史樣板套用一次做完（不分兩次） | 2026-06-16 |
