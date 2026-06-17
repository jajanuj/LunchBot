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
  - **WBS 階段二（LINE Bot 與 LIFF 點餐流程）全部完成：**
    - 外部帳號全部到位：StockBot（Messaging API channel，Channel Access Token / Channel Secret 已取得）、LunchBot 點餐（LINE Login channel，LIFF ID `2010418986-djEPOUcf` 已取得）、測試群組（StockBot 已加入，`LINE_GROUP_ID` 已取得）
    - LINE Webhook 接收與簽章驗證：`/api/line/webhook`，用官方 `@line/bot-sdk` 的 `validateSignature` 驗證，記錄所有事件並偵測群組事件印出 groupId
    - 用 ngrok 實測 Webhook 全流程通過：LINE 後台 Verify 成功、群組訊息事件正確被接收與記錄
    - Flex Message 菜單推播：`/admin/menus/[id]` 新增「推播至 LINE 群組」按鈕，同一天收單中的菜單合併成一則 Carousel 訊息推播，已實際發送到測試群組驗證成功（`npm run verify:line-push` 可重複手動驗證，故意不放進自動化測試避免洗群組版面）
    - LIFF 點餐頁面：`/liff/order`，身分綁定（從未綁定名單選姓名，防冒名）+ 點餐（數量/備註）+ upsert 修改 + 取消/重新點餐 + 截止後鎖定唯讀；因 `liff.getProfile()` 需要真實 LINE App 環境，加了僅非正式環境出現的「開發測試模式」身分模擬入口
    - 截止時間自動關閉菜單 + 截止前提醒推播：合併在 `/api/cron/menu-maintenance`（CRON_SECRET 驗證），`vercel.json` 設定 Vercel Cron 每 10 分鐘呼叫一次；新增菜單時可選填「提醒分鐘數」，到期未發送過就推播文字訊息提醒，避免重複發送
    - 助理代客新增/修改訂單：`/admin/menus/[id]` 可展開的「助理代客新增/修改訂單」區塊，選員工填數量 upsert，不受收單狀態限制（`source='assisted'`），可逐筆取消
  - **Supabase 資料庫整合全部完成（2026-06-17）：**
    - `supabase/migrations/0001_init_schema.sql`、`0002_rls_policies.sql` 已套用到真實 Supabase 專案
    - 四個資料層（employees / menus / storeTemplates / orders）全部從 mock 記憶體資料遷移至真實 Supabase PostgreSQL 查詢
    - `src/lib/data/*.ts` 皆以 `supabase` service_role client 操作；`src/lib/supabase.ts` 存放 admin client
    - 全套 E2E 測試（11 個套件、共 42 個情境）以真實 Supabase 資料庫驗證全部通過
    - 修正 cutoff_time 時區問題：`datetime-local` 輸入值統一轉換成 UTC ISO 格式後存入
    - 修正 menu-reminder-logic 測試 TypeScript import 解析問題：加上明確 `.ts` 副檔名與 `--env-file=.env.local`
    - 修正 liff-order / assisted-order / menus 測試在多次執行後的資料污染問題（改為依店家名稱定位，不依 rows[0]）
  - `npm run build` / `npm run lint` / `npm run test:e2e`（共 42 個情境）皆通過

- 🔄 **進行中**
  - 無

- ⏳ **待處理**
  - WBS 階段三（Gemini AI 菜單辨識）：需要老闆先申請 Google Gemini API Key，目前是 Supabase 整合完成後唯一還卡著的外部依賴
  - WBS 階段四（結算彙整與薪資扣款）
  - 部署到 Vercel（設定環境變數、驗證 Cron Job 執行頻率）
  - 提醒推播的「真的發送成功」只用人工方式驗證過一次（自動化測試只測「沒有提醒到期」分支，避免每次測試都真的發訊息到群組），若之後改了 `buildReminderText()` 或推播邏輯，建議照 `npm run verify:line-push` 的模式寫一個對應的手動驗證腳本
  - 部署到 Vercel 時要確認方案的 Cron 執行頻率限制（Hobby 方案曾經一度限制為每天最多 1 次），若不符合「每 10 分鐘」的設計需求，要評估改成每天固定時段或升級方案
  - 安全性待強化：LIFF 身分目前信任前端傳來的 lineUserId，沒有用 `liff.getIDToken()` 做伺服器端 JWT 驗證（內部 MVP 風險可接受，未來可加強，見 `src/app/liff/order/actions.ts` 註解）

- ⚠️ **遇到的問題 / 已修正紀錄**
  - `create-next-app` 預設會產生 `CLAUDE.md`（內容為 `@AGENTS.md` 指向檔），Windows 檔案系統不分大小寫，與既有的 `claude.md` 專案規範檔是同一個檔案，搬移專案骨架時不慎覆蓋掉原內容。已立即發現並用對話中讀取過的原始內容還原，且移除了多餘的 `AGENTS.md`。**後續若再次 scaffold 專案或新增工具，需注意 Windows 環境下檔名大小寫衝突的風險。**
  - Supabase / LINE / Gemini 等外部服務目前皆尚未建立帳號或取得金鑰，相關任務會先以本機可獨立驗證的方式（如 SQL migration 檔案、Mock 資料）進行，待老闆提供實際憑證後再串接。
  - Next.js 16 把 `middleware.ts` 改名為 `proxy.ts`（功能相同），開發前先查了 `node_modules/next/dist/docs` 才確認，避免寫了舊版檔名導致保護機制悄悄失效。
  - E2E 測試一開始用 `child.kill()` 關閉 `next dev`，在 Windows 上因為 `shell:true` 啟動的是 cmd.exe → npx → node 的程序樹，只會砍掉最外層 cmd.exe，底層 next dev server 變成孤兒程序、一路佔用 port 並持續吃記憶體（曾累積到 4 個殘留 process）。已改用 `taskkill /PID <pid> /T /F` 砍整個程序樹並清掉殘留 process，修正後 `e2e/utils.mjs` 統一處理。
  - 員工名冊 E2E 測試一開始用籤略的 `button[type="submit"]` 選擇器，在同時有「登出」按鈕與表單按鈕的頁面上點錯按鈕；後續測試斷言也誤判過殘留的錯誤訊息文字。兩個都已修正（詳見 commit b4908a3），**之後新增頁面上有多個 submit 按鈕時，務必加明確 id，不要用籤略選擇器**。
  - **重大架構排錯**：開發「截止自動關閉」功能時發現，Next.js 的 Route Handler（`/api/**/route.ts`）跟 Server Action 在 Turbopack dev 模式下可能各自有獨立的模組執行環境——後台 Server Action 建立的菜單，API Route 端完全看不到（單純的 `module-level const arr = []` 假資料庫，兩邊各有一份）。改用 `globalThis` 存資料解決，並對 `employees` / `menus` / `orders` / `storeTemplates` 四個資料層統一套用這個修正，避免日後其他跨 Route Handler 的功能（如 Webhook、排程）再踩到同一個坑。**之後新寫 mock 資料層一律用 `globalThis.__lunchbot_xxx__ ??= [...]` 的寫法，不要用單純的 module-level 變數。**
  - 發現這個專案同一時間**只能跑一個 `next dev`**，即使指定不同 port，第二個實例也會啟動失敗（連線被拒）——應該是 Turbopack 的 `.next` build 目錄鎖住了同一專案資料夾。**之後若老闆自己開著 `npm run dev`，要先請他關掉才能跑會自己啟動 dev server 的腳本（`npm run test:e2e:*`、`npm run verify:line-push`）**，`e2e/manual-verify-line-push.mjs` 已加了「偵測 3000 port 有沒有人在跑，有就借用、沒有才自己啟動」的邏輯。
  - 菜單表單的 `date` / `datetime-local` 輸入框用 Puppeteer `page.type()` 不可靠（這類輸入框是多段式編輯，不是單純文字輸入）。改用 `page.evaluate()` 直接設定 DOM `value` 並補發 `input`/`change` 事件，才能讓 React 的 controlled/uncontrolled 欄位都正確收到值。
  - LINE Developers 申請過程中，Channel Access Token 與 Channel Secret 一度完整明碼出現在截圖裡，兩組都立刻請老闆點「Issue」重新簽發、作廢舊的，新的直接存進老闆自己的 `.env.local`，沒有貼進對話紀錄。**之後若需要看 LINE 後台畫面，金鑰類欄位（Channel Secret / Access Token）務必先避開或遮住再截圖**。
  - LINE Webhook 端點是 server-to-server，沒有瀏覽器頁面可以給 Puppeteer 點，`e2e/line-webhook.test.mjs` 改用真實 HTTP request + 用 `.env.local` 裡的真正 Channel Secret 計算簽章來測試，執行時要用 `node --env-file=.env.local` 載入環境變數（npm script 已內建）。
  - 用 ngrok 串接真實 LINE Webhook 測試時，一度收到 LINE 後台「404 Not Found」的驗證失敗。原因是老闆電腦上同時跑著另一個專案（StarDuty 星際學院，`D:\WebSite\StartDust`）佔住了 port 3000，LunchBot 的 `npm run dev` 偵測到後自動換到 3001，但 ngrok 還是轉去 3000，打到別的專案去了。**之後若 `npm run dev` 沒有顯示 `Local: http://localhost:3000`，要先確認有沒有其他專案佔用 3000**，不要假設一定是 3000。已協助關閉 StarDuty 的 process 讓 LunchBot 拿回 3000，問題排除。
  - LIFF E2E 測試裡，助理用的 page 物件如果在另一個 page（LIFF 頁面）做很多步驟期間閒置太久，之後再對它 `.click()` 偶爾會卡死（`Runtime.callFunctionOn timed out`，加大 `protocolTimeout` 也沒用）。改成每次助理操作（建立菜單、結單）都開一個全新的 page 物件用完就關閉，問題排除。另外：**同一個 browser context 已經登入過後，不能再對新 page 呼叫 `loginAsMockAdmin` 導去 `/login`**，因為 cookie 還在，`proxy.ts` 會直接把 `/login` 導回 `/admin`，等不到 `#email` 欄位；新開的 page 只要直接導去要操作的網址即可，不用重新登入。

---

## 外部服務串接：目前缺什麼、怎麼申請

### 目前缺少的串接資料一覽

| 服務 | 需要的項目 | 用途 | 目前狀態 | 對應環境變數（見 `.env.local.example`） |
|---|---|---|---|---|
| Supabase | Project URL / anon key / service_role key | 正式資料庫（schema 已套用，資料層整合完成） | ✅ **已建立，已整合**（`.env.local` 已設定） | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` |
| LINE Developers - Messaging API（StockBot channel） | Channel Access Token / Channel Secret | 建立 LINE Bot、推送 Flex Message、驗證 Webhook 簽章 | ✅ **已取得**（已存進 `.env.local`，曾經明碼曝光過已重新簽發） | `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` |
| LINE Developers - LIFF（LunchBot 點餐 channel） | LIFF ID | 員工點餐頁面（LIFF App） | ✅ **已取得**：`2010418986-djEPOUcf` | `NEXT_PUBLIC_LINE_LIFF_ID` |
| LINE 群組 | 群組 ID | 推播目標群組 | ✅ **已取得**（測試群組，StockBot 已加入）：`Cdd92ab1b9874fa917a7237626a26b51d` | `LINE_GROUP_ID` |
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
6. 回到 LINE Developers Console 重新整理，這個官方帳號對應的 Channel 就會出現在該 Provider 底下的清單裡。

> **本專案實際狀況（2026-06-16 確認）：** 老闆 Provider 底下已有一個 Messaging API channel「**StockBot**」（掛在 Provider「**TestBot**」底下），確認直接拿來當 LunchBot 的 Messaging API channel 使用，不另外重建。以下步驟皆以這個 channel 為例。

#### 二、取得 Channel Secret 與 Channel Access Token
7. 進入 StockBot channel，切到「**Basic settings**」分頁，可看到 `Channel secret` → 對應 `LINE_CHANNEL_SECRET`。
8. 切到「**Messaging API**」分頁，找到「Channel access token (long-lived)」，點「Issue」簽發 → 對應 `LINE_CHANNEL_ACCESS_TOKEN`。

#### 三、設定 Webhook
9. 同一頁面的「Webhook settings」填入 Webhook URL（格式：`https://你的網域/api/line/webhook`）。本機開發階段還沒有對外網址，可先跳過，等部署到 Vercel（或用 `ngrok` 建立臨時公開網址）後再回來設定。
10. 打開「Use webhook」開關。
11. 建議把「Auto-reply messages」「Greeting messages」關閉，避免 LINE 官方預設訊息干擾我們自己的 Bot 邏輯。

#### 四、把 Bot 加入內部群組，取得群組 ID
12. 用手機 LINE 掃描 StockBot channel 頁面的 QR Code，把 Bot 加為好友。
13. 把 Bot 邀請加入公司內部要收點餐通知的 LINE 群組。
14. 群組 ID 沒有地方能直接「看到」，要透過程式取得：Bot 加入群組後，群組裡有任何訊息事件，Webhook 收到的內容裡 `source.groupId` 就是群組 ID。

> ✅ **已完成（2026-06-16）：** 用 ngrok 把本機 `/api/line/webhook` 暴露出來、在 LINE Developers 設好 Webhook URL 並 Verify 通過後，建立測試群組、把 StockBot 加入、在群組發一句話，Webhook log 印出 `groupId = Cdd92ab1b9874fa917a7237626a26b51d`，已存進 `.env.local` 的 `LINE_GROUP_ID`。

#### 五、建立 LINE Login Channel（放 LIFF 用）
> ⚠️ **2026 更新：LINE 又改規則**，LIFF App 現在**不能**加在 Messaging API channel 底下了（畫面會顯示「You can no longer add LIFF apps to a Messaging API channel. Use a LINE Login channel instead.」），必須另外建一個獨立的 **LINE Login channel** 來放 LIFF。LINE 同時把 LIFF 往「LINE MINI App」品牌整合，但那需要服務地區是日本、或台灣且經當地子公司審核通過才能用，我們不符合資格就**繼續用傳統 LIFF**即可，不用碰 MINI App。

15. 回到 Provider 頁面（跟 StockBot 同一個 Provider，即「TestBot」）。
16. 點「Create a new channel」，這次選 **LINE Login**。
17. 填寫表單：
    - **Channel name**：例如「LunchBot 點餐」
    - **Channel description**：簡單描述用途
    - **App types**：勾 **Web app**（LIFF 本質是網頁，不用勾 Mobile app）
    - 其他選填欄位（icon、隱私權政策網址）可先留空
    - **Require two-factor authentication**：與功能無關，保持預設或依帳號安全習慣即可
18. 建立完成。

> ✅ **本專案實際狀況（2026-06-16 確認）：** 已建立 LINE Login channel「**LunchBot 點餐**」，掛在 Provider「TestBot」底下（與 StockBot 同一個 Provider），Region to provide the service / Company or owner's country or region 皆已設為 **Taiwan**。Channel ID：`2010418986`。
>
> ⚠️ **這個 channel 自己的 Channel Secret 不需要存進 `.env.local`**——我們的設計只用 LIFF 拿員工的 LINE userId（前端 `liff.init()` + `liff.getProfile()`），不會用到 LINE Login 的伺服器端 OAuth token 交換，所以這組密鑰目前用不到。真正要存的 `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` 是來自 **StockBot**（Messaging API channel），不要混在一起。

19. **Add friend option**：在這個 channel 的「Basic settings」分頁，找到「Add friend option → Linked LINE Official Account」，點「Edit」連結到 StockBot，這樣員工開啟 LIFF 時會順便引導加 StockBot 好友。
20. 「LINE Login」分頁裡的「Callback URL」可以先留空——我們用的是 LIFF 流程，不會走傳統 LINE Login 的 OAuth callback 機制。

#### 六、在 LINE Login Channel 底下建立 LIFF App — ✅ 已完成（2026-06-16）
LIFF（LINE Front-end Framework）讓我們的網頁可以在 LINE App 內嵌開啟，使用者點擊「我要點餐」後不需要額外登入，網頁就能透過 LIFF SDK 拿到目前使用者的 LINE 個人資訊（userId、displayName），這在本系統裡就是員工點餐頁面的入口。

> ✅ **本專案實際狀況：** LIFF App「**員工點餐頁**」已建立完成，Size: Full，Scope: profile，Add friend option: On (Normal)，Endpoint URL 暫填 `https://your-domain.vercel.app/liff/order`（待正式網域確定後要回來改）。
> **LIFF ID：`2010418986-djEPOUcf`** → 已存進 `.env.local` 與 `.env.local.example` 的 `NEXT_PUBLIC_LINE_LIFF_ID`（LIFF ID 不是敏感資訊，可放實際值）。
> LIFF URL：`https://liff.line.me/2010418986-djEPOUcf`

21. 進入剛建立的 LINE Login channel，切到「**LIFF**」分頁，點「Add」新增一個 LIFF App。
22. 填寫表單：
    - **LIFF app name**：純粹給你自己在後台辨識用，使用者不會看到，例如「員工點餐頁」。
    - **Size**：開啟時佔的視窗大小，三選一：`Compact`（螢幕下半部小視窗）／`Tall`（約 2/3 高度）／`Full`（全螢幕）。建議選 **Full**，點餐表單需要比較多空間。
    - **Endpoint URL**：點餐頁面的網址，例如 `https://your-domain.vercel.app/liff/order`；**必須是 https**，本機 `localhost` 不能直接用（要用 `ngrok` 等工具開臨時 https 網址才能在開發階段測試）。目前還沒有正式網址，可以先填暫定網址，等 Vercel 部署網址確定後再回來改。
    - **Scope**：只需要勾選 **`profile`**（取得 userId / displayName / 頭像）；不需要 `openid`/`email`，因為身分綁定邏輯是用 userId 比對員工名冊，不需要 email。
    - 若有看到跟「Bot link feature」類似的設定，可選 On，效果同上一節提到的「連結官方帳號」。
23. 點「Add」儲存。建立成功後列表會顯示這個 LIFF App，旁邊有一串 **LIFF ID**（格式類似 `1234567890-AbCdEfGh`）→ 對應 `NEXT_PUBLIC_LINE_LIFF_ID`，點擊即可複製。
24. **測試方式**：LIFF 網址格式是 `https://liff.line.me/{LIFF ID}`，可以直接貼到聊天視窗測試——在手機 LINE App 裡點擊才會是「嵌入 LINE 內」的效果並能取得使用者資訊；用電腦瀏覽器直接打開只是一般網頁，沒有 LINE 的使用者資訊。

> ⚠️ **待開發階段驗證的風險點：** LIFF 現在掛在獨立的 LINE Login channel，跟 StockBot（Messaging API channel）是兩個不同 channel。理論上同一個 Provider 底下，同一位 LINE 使用者的 `userId` 在不同 channel 間應該是一致的，但這點需要在階段二實際開發、兩個 channel 都接好之後，**實測驗證 LIFF 的 `liff.getProfile().userId` 跟 Webhook 事件裡收到的 `userId` 是否相同**，再決定是否需要調整身分綁定邏輯。

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
| LINE 整合套件 | 用官方 SDK：`@line/bot-sdk`（伺服器端簽章驗證 + Messaging API）、`@line/liff`（前端 LIFF），不自己用 crypto/fetch 重寫 | 2026-06-16 |
