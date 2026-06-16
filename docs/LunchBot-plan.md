# 企業內部訂餐暨飲料系統 (Internal F&B Ordering System)
## 系統設計與流程規範文件 (System Design & Workflow Specification)

本文件旨在規範企業內部訂餐與飲料系統的架構設計、核心流程、資料庫結構及開發項目。本系統旨在將傳統「群組發單、人工作答、手動對帳、薪資扣款」的流程完全自動化，透過 LINE 通訊軟體與網頁技術的無縫整合，提升組織內部行政效率。

---

### 1. 系統技術棧 (Technology Stack)
系統架構採用現代化 Web 全棧組合，兼顧快速迭代能力與未來移轉至本地端伺服器（如公司 NAS Docker 環境）的彈性。

* **前端與 API 路由 (Frontend & Serverless API):** `Next.js (App Router)`
* **後端與資料庫 (Backend & Database):** `Supabase (PostgreSQL)`
* **檔案儲存 (Storage):** `Supabase Storage`（存放助理上傳之菜單原始圖片，供 AI 解析與事後追溯核對）
* **排程任務 (Scheduled Jobs):** `Vercel Cron Jobs`（或 `Supabase pg_cron`），用於截止前提醒推播、到點自動關閉收單、觸發彙整通知
* **部署環境 (Deployment):** `Vercel` (初期 PoC 快速驗證) / 預留 `Docker` 打包部署至本地端之彈性。
* **通訊與介面整合 (Third-party Integration):** `LINE Messaging API` + `LINE Front-end Framework (LIFF)`
* **AI 視覺解析模組 (AI Vision Module):** `Gemini API`

---

### 2. 外部 API 申請清單 (External APIs Required)
為確保系統順利運作，開發前需完成以下外部平台服務的申請與金鑰配置：

1. **LINE Developers**
   * **Messaging API:** 用於建立 LINE Bot，取得 `Channel Access Token` 與 `Channel Secret`，負責推送點餐 Flex Message。`Channel Secret` 亦用於驗證 Webhook 請求簽章，避免偽造請求。
   * **LINE Login (LIFF):** 用於建立 LIFF App，取得 `LIFF ID`，負責讓員工免密碼登入並驗證身分。
2. **Supabase**
   * 提供 Serverless PostgreSQL 資料庫、Auth API 與 Storage 服務，需取得專案的 `Project URL`、`anon key`（前端使用，受 RLS 限制）與 `service_role key`（僅限後端伺服器環境使用，禁止暴露於前端）。
3. **Google Cloud Platform (GCP) - Gemini API**
   * 用於實作「菜單圖片自動辨識」功能。透過 AI 模型解析上傳的紙本菜單照片，轉為結構化的系統資料，需於 GCP 取得 `API Key`。
4. **Vercel**
   * 用於託管前端網頁與 Next.js API Routes，並設定 Cron Jobs 與環境變數 (Environment Variables) 管理上述所有金鑰（僅限概念驗證階段）。

> **金鑰管理原則：** 所有 API Key / Token 一律存放於環境變數（`.env.local` 或 Vercel Environment Variables），不得提交版控；`service_role key` 僅可在 Server-side（API Route / Server Action）使用。

---

### 3. 菜單建檔與處理方式 (Menu Data Entry)
為最大化減輕助理建立表單的負擔，系統菜單建立支援雙軌並行模式：

#### 模式一：歷史樣板與手動輸入 (Manual Entry & Templates)
* **適用情境：** 品項較少、常態性重複訂購的店家（例如經常訂購的幾家固定便當店）。
* **操作流程：** 助理透過 Next.js 後台表單，手動輸入品項與價格。系統預設會將建立過的店家與菜單存為「歷史樣板」（對應資料表 `store_templates` / `template_items`，詳見 4.3、4.4），下次訂購同一家時可一鍵載入，只需微調價格後即可發布。

#### 模式二：圖片 AI 自動辨識匯入 (AI Image-to-Menu)
* **適用情境：** 第一次訂購的店家，或是品項繁多、手動輸入耗時（如手搖飲店）的全新紙本菜單。
* **技術實作流程：**
   1. **上傳圖片：** 助理在後台直接上傳該店家的實體菜單照片或宣傳單圖檔，原圖存入 `Supabase Storage`（建議使用私有 Bucket + 簽名 URL，避免店家資訊外流）。
   2. **AI 解析擷取：** 系統後端調用 Gemini API，傳遞圖片並要求模型提取圖片中的「餐點名稱」與「對應價格」。
   3. **結構化輸出：** API 將辨識結果以 JSON 陣列格式回傳至前端。
   4. **校對與寫入：** 前端介面接收資料後，自動生成預覽表格。助理可進行最後的快速校對（例如修正 AI 偶發的同音錯別字），確認無誤後一鍵批次寫入 Supabase 的 `menu_items` 資料表，並可選擇是否同步存為新的歷史樣板。
   5. **容錯處理：** 若 Gemini API 呼叫失敗、逾時，或回傳信心度過低 / 解析筆數為 0，前端應顯示明確錯誤訊息並提供「重新上傳」與「改用手動輸入」兩種退路，避免助理卡在無回應的畫面。
   6. **原始結果留存：** 不論助理是否於校對階段修改 AI 判讀結果，系統皆須將 Gemini 回傳的原始 JSON 與對應圖片路徑保存於 `menu_ai_imports`（詳見 4.6），不可因校對覆寫而遺失，供事後人工比對追溯。

---

### 4. 資料庫綱要設計 (Database Schema)

基於 Supabase (PostgreSQL) 的關聯式資料表規劃，確保餐點金額、訂單與扣款紀錄的資料完整性（Data Integrity）。

> **共通慣例：** 下表僅列出業務邏輯關鍵欄位，所有資料表皆預設包含 `created_at timestamptz default now()` 與 `updated_at timestamptz default now()` 兩個稽核欄位（略列）；所有時間相關欄位一律使用 `timestamptz`（帶時區）型態儲存，應用層以台灣標準時間（Asia/Taipei, UTC+8）顯示。

#### 4.1 員工資料表 (`employees`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 員工系統內唯一識別碼 |
| `line_user_id` | varchar(50) | Unique, Nullable | LINE 唯一的 User ID (U開頭字串)；尚未綁定前為 NULL |
| `employee_name`| varchar(20) | Not Null, Unique | 員工真實姓名（對應用戶扣款）。由助理後台預先建立完整名冊，員工僅能從「尚未被綁定」的名單中選取，不可自由輸入，防止冒用他人姓名 |
| `bound_at` | timestamptz | Nullable | 完成 LINE 身分綁定的時間，作為稽核與防呆依據 |

> **設計決策（已確認）：** 目前僅需服務單一 LINE 群組，故不另建 `line_groups` 資料表，改以環境變數 `LINE_GROUP_ID` 直接設定推播目標群組 ID；若未來需要依部門/樓層擴充多群組廣播，再行補上對應資料表與後台選擇介面。

#### 4.2 店家歷史樣板表 (`store_templates`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 樣板識別碼 |
| `store_name` | varchar(100) | Unique, Not Null | 店家名稱 |
| `last_used_at` | timestamptz | Nullable | 最近一次被套用發布菜單的時間，供後台排序「常用店家」 |

#### 4.3 樣板品項明細表 (`template_items`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 明細識別碼 |
| `template_id` | uuid | Foreign Key -> `store_templates.id` (ON DELETE CASCADE) | 所屬店家樣板 |
| `item_name` | varchar(100) | Not Null | 餐點/飲料名稱 |
| `price` | int | Not Null, check (price >= 0) | 參考單價（套用時可由助理微調後再寫入當日 `menu_items`） |

#### 4.4 每日菜單表 (`menus`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 菜單識別碼 |
| `menu_date` | date | Not Null | 點餐日期 (YYYY-MM-DD) |
| `session_name` | varchar(50) | Nullable | 場次標籤（如：午餐 / 午餐飲料），同日多張菜單時用於區分顯示，並作為 LINE Carousel 卡片標題 |
| `store_name` | varchar(100)| Not Null | 店家名稱 |
| `cutoff_time` | timestamptz | Not Null | 當日收單截止時間 |
| `reminder_minutes_before` | int | Nullable | 截止前提醒推播之提前分鐘數（如 30 表示截止前 30 分鐘提醒一次）；NULL 表示該菜單不發提醒 |
| `reminder_sent_at` | timestamptz | Nullable | 提醒訊息實際發送時間，避免排程重複觸發發送 |
| `status` | varchar(20) | Not Null, default: 'open' | 狀態: `open` (收單中) / `closed` (已結單) / `cancelled` (店家異常或助理取消整張菜單) |
| **約束** | | Unique (`menu_date`, `store_name`) | 防止同一天對同一店家重複建立菜單；**不再限制同一天僅能開一張菜單**，以支援午餐、午餐飲料等多場次併行收單 |

> **重要修正：** 原設計將 `menu_date` 設為 Unique，會導致同一天無法同時開「午餐」與「午餐飲料」兩張菜單，與系統本身「訂餐暨飲料」的定位衝突，已改為複合唯一約束。

#### 4.5 菜單品項明細表 (`menu_items`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 品項識別碼 |
| `menu_id` | uuid | Foreign Key -> `menus.id` (ON DELETE CASCADE)| 所屬菜單 |
| `item_name` | varchar(100)| Not Null | 餐點/飲料名稱 |
| `price` | int | Not Null, check (price >= 0) | 單價 |

#### 4.6 AI 辨識原始結果留存表 (`menu_ai_imports`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 匯入紀錄識別碼 |
| `menu_id` | uuid | Foreign Key -> `menus.id`, Nullable | 對應菜單；上傳辨識當下菜單可能尚未建立，待助理確認寫入後回填 |
| `store_name` | varchar(100) | Not Null | 上傳辨識時對應的店家名稱 |
| `image_path` | text | Not Null | 原始菜單圖片於 Supabase Storage 之路徑 |
| `raw_response` | jsonb | Not Null | Gemini API 回傳之原始 JSON 結果，永久保留、不因助理校對而覆寫 |
| `reviewed_items` | jsonb | Nullable | 助理校對後實際寫入 `menu_items` 的版本，供與 `raw_response` 比對差異 |
| `reviewed_by` | varchar(20) | Nullable | 執行校對之助理姓名 |

> 此表的目的是即使助理在校對階段修正了 AI 的判讀錯誤，原始辨識結果仍完整保留，供事後人工比對、追蹤 AI 辨識準確率或排查爭議。

#### 4.7 訂單主檔表 (`orders`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 訂單識別碼 |
| `menu_id` | uuid | Foreign Key -> `menus.id` | 所屬當日菜單 |
| `employee_id` | uuid | Foreign Key -> `employees.id` | 點餐員工 |
| `total_amount` | int | Not Null, default: 0 | 該筆訂單總金額 |
| `status` | varchar(20) | Not Null, default: 'pending' | 狀態: `pending` (有效) / `cancelled` (取消)。員工於截止前自行取消無需通知任何人；彙整與薪資扣款僅納入 `pending` 訂單 |
| `source` | varchar(20) | Not Null, default: 'self' | 來源: `self` (員工自助透過 LIFF 送出) / `assisted` (助理於後台代客新增或修改，如臨時插單、事後修正)。`assisted` 寫入不受 `menus.status` 是否為 `open` 限制，供稽核追蹤 |
| **約束** | | Unique (`menu_id`, `employee_id`) | 同一員工對同一張菜單僅允許一筆訂單；前端「送出」動作應實作為 upsert（已存在則更新其 `order_items`），藉此支援截止前修改訂單，而非建立多筆重複訂單 |

#### 4.8 訂單品項明細表 (`order_items`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 明細識別碼 |
| `order_id` | uuid | Foreign Key -> `orders.id` (ON DELETE CASCADE)| 所屬訂單主檔 |
| `menu_item_id` | uuid | Foreign Key -> `menu_items.id` | 所選餐點品項 |
| `quantity` | int | Not Null, default: 1 | 數量 |
| `custom_notes` | text | Nullable | 客製化備註 (如: 微糖微冰、不加蔥) |

#### 4.9 薪資扣款紀錄表 (`payroll_deductions`)
| 欄位名稱 | 資料型態 | 條件約束 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | uuid | Primary Key | 扣款紀錄識別碼 |
| `employee_id` | uuid | Foreign Key -> `employees.id` | 扣款員工 |
| `order_id` | uuid | Foreign Key -> `orders.id` | 關聯訂單 |
| `amount` | int | Not Null | 扣款金額 |
| `billing_period`| varchar(7) | Not Null | 扣款帳期月份 (格式: YYYY-MM) |
| `status` | varchar(20) | Not Null, default: 'pending' | 狀態: `pending` (待匯出/待核) / `exported` (已匯出給薪資系統) |
| **約束** | | Unique (`order_id`) | 一筆訂單僅能產生一筆扣款紀錄，避免月結批次重複執行造成重複扣款 |

#### 4.10 Row Level Security (RLS) 政策原則
前端直接以 `anon key` 連線 Supabase，**必須**對所有資料表啟用 RLS，否則任一員工可讀寫他人資料。建議政策：
* `employees`：員工僅可讀取自己 `line_user_id` 對應之列；後台管理操作改走伺服器端 `service_role key`，不受此限制亦不繞過稽核。
* `orders` / `order_items`：員工僅可讀寫 `employee_id` 對應自己列下的訂單，且僅當對應 `menus.status = 'open'` 時可寫入/修改（`source = 'self'`）。助理代客新增/修改（`source = 'assisted'`）一律走後端 API Route 搭配 `service_role key`，不受此限制，但須於後台介面留下操作人員與時間之稽核紀錄。
* `menus` / `menu_items` / `store_templates` / `template_items` / `menu_ai_imports` / `payroll_deductions`：對前端一般使用者僅開放讀取（或完全不開放），寫入動作全部收斂到後端 API Route（使用 `service_role key`）以確保金額計算與狀態轉換的一致性。

---

### 5. 系統使用流程圖 (System Workflows)

#### 流程一：助理發布今日菜單與發單通知
```
[ 助理端 Web 後台 ]
       │
       ├──► (選擇樣板 / 手動輸入) ─────┐
       │                               ▼
       └──► (上傳菜單圖片) ──► (AI 萃取品項與價格) ──► (校對確認)
                                       │
[ 儲存至 Supabase ] ◄──────────────────┘
       │
       ▼ 觸發 Next.js API Route
[ 調用 LINE Messaging API ] ──► 群組收到 Flex Message 卡片
```

> **同日多場次菜單的推播呈現（已確認設計）：** 午餐與午餐飲料因店家、截止時間通常不同，**資料庫仍各自建立獨立的 `menus` 列**（各自有自己的 `menu_id`、`cutoff_time`、結算），彼此互不影響。但為避免同一天連續推播兩次訊息造成洗版，**呈現上合併為同一則 LINE 訊息，使用 Flex Message 的 `carousel`（多頁卡片）容器**：每頁對應一個場次，使用者左右滑動切換；點擊任一頁的「我要點餐」按鈕，會帶對應的 `menuId` 開啟 LIFF，各自獨立填寫與送出。簡言之：**呈現合併（一則訊息、Carousel 滑動分頁），資料與結算分開（各自獨立 `menu_id`）**。
>
> 範例（簡化版 Flex Message JSON，省略樣式細節）：
> ```json
> {
>   "type": "flex",
>   "altText": "6/16 午餐 & 午餐飲料訂購通知",
>   "contents": {
>     "type": "carousel",
>     "contents": [
>       {
>         "type": "bubble",
>         "header": { "type": "box", "layout": "vertical",
>           "contents": [{ "type": "text", "text": "🍱 午餐｜阿明便當", "weight": "bold", "size": "lg" }] },
>         "body": { "type": "box", "layout": "vertical",
>           "contents": [{ "type": "text", "text": "截止時間：12:00", "size": "sm", "color": "#999999" }] },
>         "footer": { "type": "box", "layout": "vertical",
>           "contents": [{ "type": "button", "style": "primary",
>             "action": { "type": "uri", "label": "我要點餐", "uri": "https://liff.line.me/xxxx?menuId=MENU_LUNCH_ID" } }] }
>       },
>       {
>         "type": "bubble",
>         "header": { "type": "box", "layout": "vertical",
>           "contents": [{ "type": "text", "text": "🥤 午餐飲料｜五十嵐", "weight": "bold", "size": "lg" }] },
>         "body": { "type": "box", "layout": "vertical",
>           "contents": [{ "type": "text", "text": "截止時間：11:30", "size": "sm", "color": "#999999" }] },
>         "footer": { "type": "box", "layout": "vertical",
>           "contents": [{ "type": "button", "style": "primary",
>             "action": { "type": "uri", "label": "我要點餐", "uri": "https://liff.line.me/xxxx?menuId=MENU_DRINK_ID" } }] }
>       }
>     ]
>   }
> }
> ```

#### 流程二：員工點餐、修改與自動身分綁定 (LINE LIFF 流程)
```
[ 員工點擊「我要點餐」 ] ──► [ 開啟 LIFF 視窗 ] ──► [ 獲取 line_user_id ]
       │
       ├─── (若無紀錄) ───► [ 從「尚未綁定」員工名單中選擇本人姓名 ] ──► [ 寫入 employees.line_user_id / bound_at ]
       │
       ▼ (已綁定狀態)
[ 顯示今日菜單選單 ] ──► (填寫品項/備註送出)
       │
       ▼ upsert by (menu_id, employee_id)，orders.source = 'self'
[ 寫入/更新 Supabase orders + order_items ] ──► [ 關閉視窗 ]（無需另行通知，助理本就在截止後才彙整下單）
       │
       └─── (截止前可重新進入 LIFF 修改或取消，status 切換 pending/cancelled，不通知任何人；
             menus.status != 'open' 時，前端關閉送出/修改入口)

[ 助理後台「代客點餐 / 修改」（用於臨時插單或事後修正） ]
       │
       ▼ 不受 menus.status 是否為 open 限制
[ 寫入/更新 Supabase orders（source = 'assisted'）+ order_items ]
```
> 身分綁定為一次性、不可由員工自行更改的動作；若綁錯姓名，須由助理於後台手動修正，避免冒用他人身分造成薪資誤扣。助理代客新增/修改的訂單會標記 `source = 'assisted'`，供日後稽核追蹤是員工自助或助理代為處理。

#### 流程三：截止前提醒、收單截止與彙整通知
```
[ Vercel Cron / Supabase pg_cron 定時檢查所有 status = 'open' 的 menus ]
       │
       ├──(now ≥ cutoff_time − reminder_minutes_before，且 reminder_sent_at 為空)
       │        └──► 推播提醒訊息至 LINE 群組（如：「午餐 12:00 截止，尚未點餐請盡速」）──► 寫入 reminder_sent_at
       │
       └──(now ≥ cutoff_time)──► [ menus.status: open → closed ]
                  │
                  ├──► 彙總 order_items 依 menu_item 分組加總數量 ──► 產出「店家叫貨清單」 ──► 推播至 LINE 群組 / 通知助理（供電話訂購/取貨用）
                  │
                  └──► 彙總 orders 依 employee 分組加總金額 ──► 產出「個人對帳清單」(可匯出 CSV) ──► 提供助理/財務核對與後續薪資扣款使用
```

#### 流程四：月結薪資扣款
```
[ 助理於後台點選「產生本月扣款報表」 ]
       │
       ▼
[ 篩選 billing_period 月份內，status = 'pending' 的 orders ] ──► 依 employee_id 加總 ──► 寫入 payroll_deductions (status: pending)
       │
       ▼
[ 匯出 CSV / Excel ] ──► 提供薪資人員人工匯入既有薪資系統 ──► 完成後標記 payroll_deductions.status = 'exported'
```
> **已確認：** 僅以匯出 CSV 檔案的方式提供薪資人員人工匯入既有薪資系統使用，不開發與人資/薪資系統的 API 對接。

---

### 6. 開發項目與工作分解結構 (WBS)

> **即時開發進度請見 [docs/PROGRESS.md](PROGRESS.md)**。下列勾選代表「功能本身已開發完成」；部分項目目前以伺服器記憶體 mock 資料層頂著（尚未串接真正的 Supabase），待外部服務（Supabase / LINE / Gemini）帳號到位後才會是正式可上線狀態，detail 見 PROGRESS.md。

#### 階段一：核心資料庫與點餐後台 (MVP) — ✅ 已全部完成（2026-06-16）
- [x] 撰寫 Supabase 資料庫 schema migration 檔案，依第 4 節建立 9 張資料表、Foreign Key 約束與 RLS 政策（`supabase/migrations/`）—— *Supabase 專案尚未建立，待建立後套用驗證*
- [x] 建立 `employees` 員工名冊匯入機制（後台批次匯入或手動新增）—— `/admin/employees`
- [x] 開發 Next.js 後台：店家/菜單 CRUD（手動輸入模式）—— `/admin/menus`
- [x] 開發歷史樣板（`store_templates` / `template_items`）載入與套用功能 —— 與菜單 CRUD 一併完成

#### 階段二：LINE Bot 與 LIFF 點餐流程 — 🔄 進行中
- [x] 申請並設定 LINE Messaging API（StockBot channel）+ LIFF App（LunchBot 點餐 channel，LIFF ID 已取得）—— `LINE_GROUP_ID` 已透過 Webhook log 取得（測試群組）
- [x] 實作 Webhook 接收與 `X-Line-Signature` 簽章驗證 —— `/api/line/webhook`，用官方 `@line/bot-sdk`
- [x] 實作 Flex Message 菜單推播（同日多場次以 Carousel 多頁卡片合併呈現於同一則訊息）—— `/admin/menus/[id]` 推播按鈕，已實測發送成功
- [x] 實作 LIFF 點餐頁面：身分綁定（防呆）、品項選擇、備註、送出 / 修改 / 取消（upsert 邏輯，無需通知）—— `/liff/order`
- [x] 實作截止時間自動關閉菜單（Vercel Cron / Supabase pg_cron）—— `/api/cron/close-expired-menus` + `vercel.json`
- [ ] 實作截止前提醒推播（依 `reminder_minutes_before` / `reminder_sent_at` 設定，到時間自動發送一次提醒訊息）
- [ ] 實作助理後台「代客新增/修改訂單」功能（不受收單狀態限制，寫入時標記 `orders.source = 'assisted'`）

#### 階段三：AI 視覺解析菜單匯入 — ⏳ 待處理（需先申請 Gemini API Key，見下方第 6.1 節）
- [ ] 整合 Gemini API，實作圖片上傳（Supabase Storage）與 OCR 解析 API Route
- [ ] 開發前端校對介面（預覽表格、批次寫入 `menu_items`，並將原始辨識結果存入 `menu_ai_imports`）
- [ ] 實作解析失敗 / 低信心度之容錯與重試流程

#### 階段四：結算彙整與薪資扣款 — ⏳ 待處理
- [ ] 實作收單後「店家叫貨清單」與「個人對帳清單」彙整與推播 / 匯出
- [ ] 實作月結薪資扣款報表產生（寫入 `payroll_deductions`）與 CSV 匯出

#### 6.1 目前卡關的外部帳號申請
階段二、三開工前，需要老闆先完成以下外部帳號申請（無法用 mock 資料模擬，因 LIFF 本質要在真實 LINE App / 真實 LIFF ID 下才能驗證）。**詳細逐步申請教學已整理在 [docs/PROGRESS.md](PROGRESS.md) 的「外部服務串接：目前缺什麼、怎麼申請」一節**，這裡只列需要拿到的項目：
- LINE Developers：`Channel Access Token`、`Channel Secret`、`LIFF ID`、`LINE_GROUP_ID`
- Google：`Gemini API Key`
- Supabase：`Project URL`、`anon key`、`service_role key`（schema 已寫好，建立專案後即可套用）

---

### 7. 維護與安全性規範
1. **資料防篡改：** 所有涉及金額計算的邏輯，必須由後端 API 在伺服器端加總計算後寫入，前端傳入的金額一律視為不可信。
2. **時區處理：** 資料庫一律使用 `timestamptz` 明確處理時區，並以台灣標準時間（Asia/Taipei）對使用者顯示。
3. **存取控制 (RLS)：** 所有資料表須啟用 Row Level Security，前端 `anon key` 僅可存取使用者本人相關資料；金額計算、狀態轉換、助理代客操作（`orders.source = 'assisted'`）等寫入動作集中於伺服器端 API Route，使用 `service_role key`。
4. **Webhook 驗證：** LINE Webhook 端點須驗證 `X-Line-Signature`，拒絕未通過驗證的請求，避免偽造推播或惡意觸發。
5. **身分綁定防呆：** 員工綁定 LINE 身分時僅能從「尚未被綁定」的員工名單中選取本人姓名，且綁定後不可由本人自行變更，僅可由助理於後台手動修正，避免冒用他人姓名造成薪資誤扣。
6. **機密金鑰管理：** 所有 API Key / Token（LINE、Supabase、Gemini）一律存於環境變數，不得提交版控；`service_role key` 僅可用於伺服器端。
7. **圖片資料保護：** AI 辨識用之菜單原始圖片存放於 Supabase Storage 私有 Bucket，前端僅透過短效期簽名 URL 存取，避免店家資訊外流。
8. **AI 辨識留痕：** `menu_ai_imports` 保留之原始圖片路徑與 JSON 結果應視為內部資料，僅供助理/管理者比對追溯，不對外公開存取。

---

### 8. 設計決策紀錄 (Decision Log)
以下事項原列於待確認事項，目前皆已與業務面確認決策，記錄於此供後續開發與追溯依據：

1. **同日多場次菜單呈現：** 午餐、午餐飲料等同日多場次各自建立獨立 `menus` 列（各自 `menu_id` / `cutoff_time` / 結算），但呈現上合併為同一則 LINE 訊息、以 Flex Message `carousel`（多頁卡片）滑動切換，避免同日連續推播造成洗版（範例見「5. 系統使用流程圖」流程一附註）。
2. **修改/取消不通知：** 員工於截止前修改或取消訂單僅更新 `orders.status`，不發送任何通知。因助理本就是在截止後才依「個人對帳清單」實際向店家下單，截止前的異動不影響助理作業。
3. **薪資扣款匯出方式：** 確定僅以匯出 CSV 檔案的方式提供薪資人員人工匯入既有薪資系統，不開發與人資/薪資系統的 API 對接。
4. **LINE 群組：** 確定 MVP 階段僅服務單一群組，不建立 `line_groups` 資料表，改以環境變數 `LINE_GROUP_ID` 設定目標群組；若未來需要多群組廣播再行擴充資料庫設計。
5. **AI 辨識原始結果保留：** 新增 `menu_ai_imports` 資料表，保留 Gemini 回傳之原始 JSON 與圖片路徑，不因助理校對而覆寫遺失，供事後人工比對追溯。
6. **截止前提醒推播：** 新增 `menus.reminder_minutes_before` / `reminder_sent_at` 欄位，由排程於截止前指定分鐘數自動發送一次提醒訊息至 LINE 群組，並避免重複發送。
7. **助理代客介入：** 新增 `orders.source` 欄位（`self` / `assisted`），支援助理於後台直接代客新增或修改訂單（不受收單狀態限制），用於處理臨時插單或事後修正，並可依此稽核操作來源。

---

### 9. 版本控制與修訂歷史 (Revision History)
為確保後續追蹤與維護之延續性，每次系統架構變更、功能調整或核心邏輯修改，皆須於下表填寫詳細之版次紀錄。

| 版本號 | 修訂日期 | 修訂人員 | 變更類型 | 變更描述與主要修改內容 |
| :--- | :--- | :--- | :--- | :--- |
| **v1.7.0** | 2026-06-16 | James | 開發進度更新 | 第 6 節 WBS 階段二新增完成項目：截止時間自動關閉菜單（`/api/cron/close-expired-menus` + `vercel.json`）。開發過程中發現並修正 mock 資料層架構性 bug：Route Handler 與 Server Action 在 dev 模式下模組執行環境可能不同，改用 `globalThis` 確保資料一致共享。階段二剩餘：提醒推播、助理代客下單。 |
| **v1.6.0** | 2026-06-16 | James | 開發進度更新 | 第 6 節 WBS 階段二新增完成項目：Flex Message 菜單推播（`/admin/menus/[id]`，已實測發送至 LINE 群組成功）、LIFF 點餐頁面（`/liff/order`，含身分綁定/點餐/修改/取消/截止鎖定）。階段二剩餘：截止自動關閉、提醒推播、助理代客下單。 |
| **v1.5.0** | 2026-06-16 | James | 開發進度更新 | 第 6 節 WBS 階段二標記為「進行中」：LINE Messaging API（StockBot channel）+ LIFF App（LunchBot 點餐 channel）已申請完成、Webhook 接收與簽章驗證已開發完成（`/api/line/webhook`，用 `@line/bot-sdk`）。 |
| **v1.4.0** | 2026-06-16 | James | 開發進度更新 | 1. 第 6 節 WBS 標記階段一（核心資料庫與點餐後台）全部完成，並加上即時進度指向 `docs/PROGRESS.md` 的提示。<br>2. 新增第 6.1 節「目前卡關的外部帳號申請」，列出階段二、三開工前需要的 LINE Developers / Gemini 帳號與金鑰項目，並指向 PROGRESS.md 的逐步申請教學。 |
| **v1.3.0** | 2026-06-16 | James | 業務決策確認與設計細化 | 1. 確認同日多場次菜單採「Carousel 多頁卡片」合併呈現，並提供 Flex Message 範例。<br>2. 員工修改/取消訂單改為不通知任何人。<br>3. 確認薪資扣款僅以 CSV 匯出，不對接人資/薪資系統 API。<br>4. 移除 `line_groups` 資料表與 `menus.target_group_id`，改用環境變數設定單一群組。<br>5. 新增 `menu_ai_imports` 資料表，永久保留 Gemini 原始辨識結果供人工比對。<br>6. 新增 `menus.reminder_minutes_before` / `reminder_sent_at`，支援截止前提醒推播。<br>7. 新增 `orders.source`（self/assisted），支援助理後台代客新增/修改訂單（不受收單狀態限制）。<br>8. 第 8 節由「待確認事項」轉為「設計決策紀錄」，記錄上述已確認決策。 |
| **v1.2.0** | 2026-06-16 | James | 架構審查補強 | 1. 修正 `menus.menu_date` 唯一約束過嚴問題，改為 (menu_date, store_name) 複合約束，支援同日多場次（午餐/下午茶）並行收單。<br>2. 新增 `store_templates` / `template_items` 資料表，補齊第 3 節歷史樣板功能對應的資料庫設計。<br>3. 新增 `line_groups` 資料表，預留多群組廣播擴充彈性。<br>4. 新增 `orders.status`、`payroll_deductions.status` 欄位與 (menu_id, employee_id) 唯一約束，支援截止前修改/取消訂單並避免重複下單與重複扣款。<br>5. 新增 RLS 政策原則、LINE Webhook 簽章驗證、身分綁定防呆、金鑰管理與圖片儲存權限等安全性規範。<br>6. 補完第 6 節 WBS 實際工作項目（原文件為空白佔位）。<br>7. 新增流程三（收單彙整通知）、流程四（月結薪資扣款）流程圖。<br>8. 新增「待確認事項與已知風險」章節，列出需業務面決策之未決問題。 |
| **v1.1.0** | 2026-06-16 | James | 架構擴充 | 1. 版本紀錄移至文件末端。<br>2. 新增外部 API 申請清單。<br>3. 規劃菜單圖片 AI 自動辨識功能 (整合 Gemini API)。 |
| **v1.0.0** | 2026-06-16 | James | 初始建立 | 確立系統整體架構、資料庫 Schema、LINE LIFF 工作流程與開發項目 WBS。 |
