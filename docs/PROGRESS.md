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

## 外部服務串接：目前缺什麼、怎麼申請

### 目前缺少的串接資料一覽

| 服務 | 需要的項目 | 用途 | 目前狀態 | 對應環境變數（見 `.env.local.example`） |
|---|---|---|---|---|
| Supabase | Project URL / anon key / service_role key | 正式資料庫（schema 已寫好待套用） | 尚未建立專案 | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` |
| LINE Developers - Messaging API | Channel Access Token / Channel Secret | 建立 LINE Bot、推送 Flex Message、驗證 Webhook 簽章 | 尚未申請 | `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` |
| LINE Developers - LIFF | LIFF ID | 員工點餐頁面（LIFF App） | 尚未申請 | `NEXT_PUBLIC_LINE_LIFF_ID` |
| LINE 群組 | 群組 ID | 推播目標群組 | 尚未取得（要先把 Bot 加入群組才能取得，見下方步驟 12） | `LINE_GROUP_ID` |
| Google Gemini | API Key | 菜單圖片 AI 辨識 | 尚未申請 | `GEMINI_API_KEY` |

拿到金鑰後，請依 `.env.local.example` 把對應的環境變數加進你自己電腦的 `.env.local`（此檔已被 `.gitignore` 排除、不會進版控）。**金鑰不需要貼給我**，你自己填好存檔即可，下次接手開發時會自動讀到。

### LINE Developers 申請步驟

#### 一、建立 Provider 與 Messaging API Channel
> ⚠️ **2026 更新：LINE 已改流程**，不能再直接在 Developers Console 建立 Messaging API channel，必須先建立 LINE 官方帳號（LINE Official Account），建好後才會自動產生對應的 Messaging API channel。以下步驟已更新為目前的實際流程。

1. 前往 [developers.line.biz/console](https://developers.line.biz/console/)，用 LINE 帳號登入。
2. 若還沒有 Provider，先建立一個（建議用公司名稱，例如「OO股份有限公司」）；Provider 可理解成「公司」這層，底下可以放多個 Channel。
3. 在該 Provider 下點「Create a new channel」→ 選 **Messaging API** 時，會看到提示「It's no longer possible to create Messaging API channels directly from the LINE Developers Console」，請點頁面上的「**Create a LINE Official Account**」按鈕（會連到外部網站 LINE 官方帳號管理後台，manager.line.biz）。
4. 在官方帳號管理後台建立新帳號，需要填：
   - **帳號名稱**：員工在 LINE 上會看到的顯示名稱，例如「公司午餐訂購」
   - 國家/地區、產業類別，可能需要手機號碼驗證
   - **方案（Plan）**：建議先選 **免費方案**，公司內部用量通常在免費額度內，超過再考慮升級
5. 建立完成後，官方帳號通常會自動啟用 Messaging API；若沒有，到後台「設定 > Messaging API」頁面手動啟用，並選擇歸屬到上面建立的 Provider。
6. 回到 LINE Developers Console 重新整理，這個官方帳號對應的 Channel 就會出現在該 Provider 底下的清單裡，點進去即為後續步驟要用的 Channel。

#### 二、取得 Channel Secret 與 Channel Access Token
5. 進入該 Channel，切到「**Basic settings**」分頁，可看到 `Channel secret` → 對應 `LINE_CHANNEL_SECRET`。
6. 切到「**Messaging API**」分頁，找到「Channel access token (long-lived)」，點「Issue」簽發 → 對應 `LINE_CHANNEL_ACCESS_TOKEN`。

#### 三、設定 Webhook
7. 同一頁面的「Webhook settings」填入 Webhook URL（格式：`https://你的網域/api/line/webhook`）。本機開發階段還沒有對外網址，可先跳過，等部署到 Vercel（或用 `ngrok` 建立臨時公開網址）後再回來設定。
8. 打開「Use webhook」開關。
9. 建議把「Auto-reply messages」「Greeting messages」關閉，避免 LINE 官方預設訊息干擾我們自己的 Bot 邏輯。

#### 四、把 Bot 加入內部群組，取得群組 ID
10. 用手機 LINE 掃描 Channel 頁面的 QR Code，把 Bot 加為好友。
11. 把 Bot 邀請加入公司內部要收點餐通知的 LINE 群組。
12. 群組 ID 沒有地方能直接「看到」，要透過程式取得：Bot 加入群組後，群組裡有任何訊息事件，Webhook 收到的內容裡 `source.groupId` 就是群組 ID。等階段二把 Webhook 接好後，我會先加一行記錄把這個值印出來，你看 log 把它存進 `.env.local` 即可，**現在不用急著處理這一步**。

#### 五、建立 LIFF App
LIFF（LINE Front-end Framework）讓我們的網頁可以在 LINE App 內嵌開啟，使用者點擊「我要點餐」後不需要額外登入，網頁就能透過 LIFF SDK 拿到目前使用者的 LINE 個人資訊（userId、displayName），這在本系統裡就是員工點餐頁面的入口。LIFF App 必須建立在一個已存在的 Channel 之下，所以要先完成「一、建立 Provider 與 Messaging API Channel」，直接在同一個 Channel 底下加 LIFF，不需要另開一個 Channel。

13. 登入 [LINE Developers Console](https://developers.line.biz/console/)，點進你的 Provider，再點進前面建立的 Messaging API Channel（如「午餐訂購機器人」）。
14. 在 Channel 詳情頁面上方的分頁列，點「**LIFF**」分頁，再點「Add」新增一個 LIFF App。
15. 填寫表單：
    - **LIFF app name**：純粹給你自己在後台辨識用，使用者不會看到，例如「員工點餐頁」。
    - **Size**：開啟時佔的視窗大小，三選一：`Compact`（螢幕下半部小視窗）／`Tall`（約 2/3 高度）／`Full`（全螢幕）。建議選 **Full**，點餐表單需要比較多空間。
    - **Endpoint URL**：點餐頁面的網址，例如 `https://your-domain.vercel.app/liff/order`；**必須是 https**，本機 `localhost` 不能直接用（要用 `ngrok` 等工具開臨時 https 網址才能在開發階段測試）。目前還沒有正式網址，可以先填暫定網址，等 Vercel 部署網址確定後再回來改。
    - **Scope**：只需要勾選 **`profile`**（取得 userId / displayName / 頭像）；不需要 `openid`/`email`，因為身分綁定邏輯是用 userId 比對員工名冊，不需要 email。
    - **Bot link feature**：建議選 **On (Normal)**——如果員工還沒加 Bot 好友，開啟 LIFF 時會順便引導加好友（員工要先加好友才能收到菜單推播）。
    - **Scan QR**：不需要勾選。
16. 點「Add」儲存。建立成功後列表會顯示這個 LIFF App，旁邊有一串 **LIFF ID**（格式類似 `1234567890-AbCdEfGh`）→ 對應 `NEXT_PUBLIC_LINE_LIFF_ID`，點擊即可複製。
17. **測試方式**：LIFF 網址格式是 `https://liff.line.me/{LIFF ID}`，可以直接貼到聊天視窗測試——在手機 LINE App 裡點擊才會是「嵌入 LINE 內」的效果並能取得使用者資訊；用電腦瀏覽器直接打開只是一般網頁，沒有 LINE 的使用者資訊。

> 之後程式碼會用 `@line/liff` 套件做 `liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID })`，初始化後呼叫 `liff.getProfile()` 拿到員工的 LINE userId，這部分屬於階段二的開發工作，現在只需要先把 LIFF App 建好、把 LIFF ID 存進 `.env.local`。

> 💡 LINE Messaging API 有免費額度（每月可推送訊息數有上限），公司內部用量通常在免費額度內；人數變多時再留意 LINE 官方計費頁面即可。

### Google Gemini API Key 申請步驟

最簡單的方式是用 **Google AI Studio**（不需要先架設 GCP 專案）：
1. 前往 [aistudio.google.com/apikey](https://aistudio.google.com/apikey)，用 Google 帳號登入。
2. 點「Create API key」。
3. 第一次使用會請你選一個 Google Cloud 專案來掛這個 Key（沒有的話會自動幫你建一個新的）。
4. 建立完成後會顯示一串 API Key → 對應 `GEMINI_API_KEY`。**只會完整顯示一次，請先複製存好**（之後可回頁面查看或重新產生，但看不到原始字串本體）。

> 如果之後用量變大、需要更嚴謹的權限管控（限制只能呼叫特定 API、限制 IP 來源），可改到 [Google Cloud Console](https://console.cloud.google.com/) 的「API 和服務 > 憑證」頁面建立 API Key，並啟用「Generative Language API」，同時加上使用限制。建議先用 AI Studio 的免費額度測試功能沒問題後，再評估是否需要綁信用卡開計費。

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
