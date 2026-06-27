# LunchBot 專案架構說明

> 版本：1.0　更新日期：2026-06-27

---

## 目錄

1. [系統概覽](#1-系統概覽)
2. [目錄結構](#2-目錄結構)
3. [前端架構（Next.js App Router）](#3-前端架構nextjs-app-router)
4. [資料庫架構（Supabase PostgreSQL）](#4-資料庫架構supabase-postgresql)
5. [認證機制](#5-認證機制)
6. [API 路由](#6-api-路由)
7. [LINE 整合](#7-line-整合)
8. [AI 辨識（Gemini）](#8-ai-辨識gemini)
9. [排程任務（Vercel Cron）](#9-排程任務vercel-cron)
10. [E2E 測試架構](#10-e2e-測試架構)
11. [部署環境](#11-部署環境)
12. [環境變數一覽](#12-環境變數一覽)
13. [資料流圖](#13-資料流圖)

---

## 1. 系統概覽

LunchBot 是一套公司內部午餐訂購管理系統，由以下三個主要介面組成：

| 介面 | 路徑 | 使用者 | 說明 |
|------|------|--------|------|
| 後台管理介面 | `/admin/*` | 助理 | 菜單管理、員工管理、彙整、薪資扣款 |
| LIFF 點餐頁 | `/liff/order` | 員工 | 透過 LINE 內嵌瀏覽器點餐 |
| LINE Webhook | `/api/line/webhook` | LINE 平台 | 接收 LINE 訊息事件 |

### 系統整體流程

```
[助理] 建立菜單（後台）
       ↓
[助理] 推播菜單 Flex Message → LINE 群組
       ↓
[員工] 點擊訊息連結 → LIFF 點餐頁 → 送出訂單
  或 [助理] 在後台代客點餐
       ↓
[系統] Vercel Cron 每天固定時間：
       - 截止前提醒推播（文字訊息）
       - 截止後自動結單
       ↓
[助理] 查看叫貨清單、個人對帳清單、匯出 CSV
       ↓
[助理] 月底產生薪資扣款紀錄、匯出 CSV
```

---

## 2. 目錄結構

```
LunchBot/
├── src/
│   ├── app/                        # Next.js App Router 頁面
│   │   ├── admin/                  # 後台管理介面
│   │   │   ├── layout.tsx          # 後台共用 Layout（導覽列）
│   │   │   ├── page.tsx            # 後台首頁
│   │   │   ├── employees/          # 員工名冊管理
│   │   │   ├── menus/              # 菜單管理
│   │   │   │   ├── [id]/           # 菜單詳細頁（動態路由）
│   │   │   │   └── new/            # 建立菜單
│   │   │   ├── stores/             # 店家管理
│   │   │   │   ├── [id]/           # 編輯店家（動態路由）
│   │   │   │   └── new/            # 新增店家
│   │   │   └── payroll/            # 薪資扣款
│   │   ├── api/                    # API Route Handlers
│   │   │   ├── ai/parse-menu/      # Gemini AI 菜單辨識
│   │   │   ├── cron/menu-maintenance/ # Vercel Cron 排程
│   │   │   └── line/webhook/       # LINE Webhook 接收
│   │   ├── liff/order/             # 員工 LIFF 點餐頁
│   │   ├── login/                  # 後台登入頁
│   │   ├── globals.css             # 全域樣式
│   │   └── layout.tsx              # 根 Layout
│   ├── lib/
│   │   ├── auth/                   # 認證相關
│   │   │   ├── actions.ts          # 登入 Server Action
│   │   │   ├── credentials.ts      # 帳號設定（mock 帳號）
│   │   │   ├── dal.ts              # Data Access Layer（安全驗證）
│   │   │   └── session.ts          # Session Cookie（HMAC 簽章）
│   │   ├── data/                   # 資料存取層
│   │   │   ├── employees.ts        # 員工 CRUD
│   │   │   ├── menus.ts            # 菜單 CRUD
│   │   │   ├── menuAiImports.ts    # AI 辨識紀錄
│   │   │   ├── orders.ts           # 訂單 CRUD
│   │   │   ├── payrollDeductions.ts # 薪資扣款
│   │   │   └── storeTemplates.ts   # 店家樣板 CRUD
│   │   ├── line/
│   │   │   ├── client.ts           # LINE Messaging API client
│   │   │   ├── flexMessage.ts      # Flex Message 建構函式
│   │   │   └── webhook.ts          # Webhook 簽章驗證
│   │   └── supabase.ts             # Supabase admin client
│   └── proxy.ts                    # Next.js Middleware（路由保護）
├── e2e/                            # E2E 測試腳本（Puppeteer）
├── supabase/
│   └── migrations/                 # 資料庫 migration SQL 檔
├── docs/                           # 文件
├── vercel.json                     # Vercel Cron 設定
└── package.json
```

---

## 3. 前端架構（Next.js App Router）

### 渲染模式

本專案全面採用 Next.js 16 App Router，有三種元件形式：

| 形式 | 說明 | 範例 |
|------|------|------|
| **Server Component（預設）** | 在伺服器端渲染，可直接讀取 DB，不送 JS 到瀏覽器 | `menus/page.tsx`、`menus/[id]/page.tsx` |
| **Client Component（`"use client"`）** | 需要互動狀態（useState/useTransition），運行在瀏覽器 | `stores-client.tsx`、`menu-list-table.tsx` |
| **Server Action（`"use server"`）** | 在伺服器執行的非同步函式，被 Client Component 或 form 呼叫 | `menus/actions.ts`、`employees/actions.ts` |

### 頁面資料流

```
User Request
    ↓
proxy.ts（Middleware）── 未登入 → 導向 /login
    ↓ 已登入
Server Component（page.tsx）
    ↓
lib/auth/dal.ts → verifySession()（安全驗證）
    ↓
lib/data/*.ts → Supabase 查詢
    ↓
回傳 props 給 Client Component 渲染
    ↓
用戶操作（點擊按鈕）
    ↓
Server Action（actions.ts）
    ↓
Supabase 寫入 → revalidatePath() → 頁面更新
```

### 路由保護

雙層防護設計：

1. **proxy.ts（Middleware）**：快速樂觀檢查 cookie 是否存在，不存在直接導向 `/login`
2. **dal.ts（DAL）**：每個 Server Component 都呼叫 `verifySession()`，真正驗證 token 有效性

---

## 4. 資料庫架構（Supabase PostgreSQL）

### 資料表關聯圖

```
employees
  ├── orders (employee_id)
  │     └── order_items (order_id)
  └── payroll_deductions (employee_id)
         └── orders (order_id)

store_templates
  └── template_items (template_id)

menus
  ├── menu_items (menu_id)
  ├── orders (menu_id)
  │     └── order_items (order_id)
  └── menu_ai_imports (menu_id)
```

### 資料表說明

| 資料表 | 說明 | 主要欄位 |
|--------|------|----------|
| `employees` | 員工名冊 | `employee_name`、`line_user_id`（LINE 綁定） |
| `store_templates` | 店家歷史樣板 | `store_name`、`last_used_at` |
| `template_items` | 樣板品項 | `template_id`、`item_name`、`price` |
| `menus` | 每日菜單 | `menu_date`、`store_name`、`cutoff_time`、`status` |
| `menu_items` | 菜單品項 | `menu_id`、`item_name`、`price`、`category` |
| `menu_ai_imports` | AI 辨識紀錄 | `menu_id`、`image_path`、`raw_response`（JSONB） |
| `orders` | 訂單主檔 | `menu_id`、`employee_id`、`total_amount`、`source` |
| `order_items` | 訂單品項 | `order_id`、`menu_item_id`、`quantity`、`price`（下單時快照） |
| `payroll_deductions` | 薪資扣款 | `employee_id`、`order_id`、`amount`、`billing_period`、`status` |

### 重要設計決策

- **`order_items.price`**：下單時寫入當下品項價格快照，避免菜單改價後歷史對帳金額失真
- **`ON DELETE CASCADE`**：刪菜單 → 自動刪 menu_items / orders / order_items
- **`unique(menu_date, store_name)`**：同天同店只能建一個菜單
- **`unique(menu_id, employee_id)`**：同員工同菜單只有一筆訂單（upsert 機制）
- **Row Level Security（RLS）**：前端不直接連 Supabase；後端一律用 `service_role key` 繞過 RLS，確保所有存取都經過 Next.js 控管

### Migration 歷史

| 檔案 | 說明 |
|------|------|
| `0001_init_schema.sql` | 建立所有資料表與 trigger |
| `0002_rls_policies.sql` | 設定 RLS（預設全拒絕）|
| `0003_grant_privileges.sql` | 授權 service_role 存取 |
| `0004_cascade_delete_on_menus.sql` | 加 ON DELETE CASCADE |
| `0005_menu_item_category.sql` | 品項加 category 欄位 |
| `0006_menu_type.sql` | 菜單加 menu_type（食物/飲料）欄位 |
| `0007_payroll_deductions.sql` | 建立薪資扣款表 |
| `0008_fix_payroll_cascade.sql` | 修正薪資扣款的 CASCADE |
| `0009_add_price_to_order_items.sql` | order_items 加 price 快照欄位 |

---

## 5. 認證機制

### 流程

```
用戶輸入帳號密碼
    ↓
credentials.ts → 比對 scrypt 雜湊密碼
    ↓ 驗證通過
session.ts → 建立 JWT-like token
  payload = { email, displayName, exp } → Base64url 編碼
  signature = HMAC-SHA256(payload, AUTH_SECRET)
  token = payload.signature
    ↓
Set-Cookie: lb_session=token（HttpOnly、Secure、SameSite=Lax）
    ↓
每次請求：proxy.ts 快速驗簽 → page.tsx → dal.ts 完整驗簽
```

### 特點

- 使用 Node.js 內建 `crypto` 模組，不依賴第三方 JWT 套件
- `timingSafeEqual()` 防止 timing attack
- Token 有效期 8 小時
- 架構設計為可直接換成 Supabase Auth（介面一致）

---

## 6. API 路由

### `/api/line/webhook`（POST）

接收 LINE 平台的所有事件（訊息、加入群組等）：

1. 驗證 `X-Line-Signature`（HMAC-SHA256，用 Channel Secret）
2. 解析事件類型
3. 若為群組事件，印出 `groupId`（初始設定用）

### `/api/ai/parse-menu`（POST）

接收菜單圖片，回傳辨識結果：

1. 接收 multipart form-data 圖片
2. 上傳至 Supabase Storage
3. 呼叫 Gemini API（`gemini-2.5-flash`）辨識品項與價格
4. 遇 429 / 503 最多重試 3 次
5. 儲存原始回應至 `menu_ai_imports`
6. 回傳品項清單 JSON

### `/api/cron/menu-maintenance`（GET）

Vercel Cron 定時呼叫（`vercel.json` 設定），以 `CRON_SECRET` Bearer token 驗證：

1. 查詢截止前提醒到期的菜單 → 推播文字提醒至 LINE 群組
2. 查詢已超過截止時間的「收單中」菜單 → 批次結單

### `/admin/payroll/api`（GET）

薪資扣款 CSV 匯出端點，回傳 `text/csv` 格式串流。

---

## 7. LINE 整合

### 7-1. Messaging API（推播）

- 套件：`@line/bot-sdk`（官方 SDK）
- 用途：推播菜單 Flex Message、叫貨清單、截止提醒

**Flex Message 結構（Carousel）：**
```
FlexMessage
  └── FlexCarousel
        └── FlexBubble × N（每個菜單一個 Bubble）
              ├── header：菜單標題（店家名 + 餐別 emoji）
              ├── body：截止時間、品項數
              └── footer：「我要點餐」按鈕（URI action → LIFF URL）
```

- LIFF URL 格式：`https://liff.line.me/{LIFF_ID}?menuId={menuId}`

### 7-2. LIFF（員工點餐）

- 套件：`@line/liff`（官方 LIFF SDK）
- 運作流程：

```
員工點擊 LINE 訊息中的「我要點餐」
    ↓
LINE App 內嵌瀏覽器開啟 /liff/order?menuId=xxx
    ↓
liff.init({ liffId }) → 自動取得 LINE 登入狀態
    ↓
liff.getProfile() → 取得 { userId, displayName }
    ↓ 尚未綁定
選擇員工姓名 → 建立 line_user_id 綁定
    ↓ 已綁定
顯示菜單品項 → 員工點餐 → Server Action 寫入訂單
```

- 菜單類型（`menu_type`）控制 UI：飲料店顯示冰量/糖量 pill 選鈕，食物店只顯示備註欄

### 7-3. Webhook

- 主要用途：初始設定時取得 LINE 群組 ID
- 簽章驗證：`validateSignature(body, channelSecret, signature)`

---

## 8. AI 辨識（Gemini）

- 模型：`gemini-2.5-flash`（Google Generative AI）
- 流程：
  1. 助理上傳菜單照片（JPEG / PNG）
  2. 圖片儲存至 Supabase Storage（`menu-images` bucket）
  3. 送 Gemini API：圖片 + prompt「請辨識品項名稱與價格，回傳 JSON 陣列 [{name, price}]」
  4. 解析 JSON → 顯示預覽讓助理確認 / 修改
  5. 點「套用至表單」→ 自動填入品項欄位
  6. 建菜單後，辨識紀錄存入 `menu_ai_imports`（含原始 response，方便稽核）

- 錯誤處理：
  - `429 RESOURCE_EXHAUSTED`：等 1 秒後重試，最多 3 次
  - `503`：同上

---

## 9. 排程任務（Vercel Cron）

```jsonc
// vercel.json
{
  "crons": [{
    "path": "/api/cron/menu-maintenance",
    "schedule": "0 22 * * *"  // 每天 UTC 22:00 = 台北時間 06:00
  }]
}
```

執行順序：
1. **截止前提醒**：找 `reminder_minutes_before` 到期且未發送過提醒的菜單 → 推播文字訊息
2. **自動結單**：把 `cutoff_time < now()` 且 `status = 'open'` 的菜單改為 `'closed'`，並推播叫貨清單

> ⚠️ Vercel Hobby 方案 Cron 執行頻率每天最多 1 次，本專案已調整為一天一次固定時段。

---

## 10. E2E 測試架構

### 工具

- **Puppeteer**（headless Chrome）— 模擬真實瀏覽器操作
- 測試腳本統一放 `e2e/` 目錄，用 `node e2e/xxx.test.mjs` 執行
- 共用工具：`e2e/utils.mjs`（`waitForServerReady`、`killProcessTree`、`loginAsMockAdmin`、`assert`）

### 測試套件一覽

| 腳本 | Port | 情境數 | 說明 |
|------|------|--------|------|
| `smoke.test.mjs` | 3100 | 1 | 首頁能正常回應 |
| `login.test.mjs` | 3102 | 4 | 登入成功/失敗/登出/未登入導向 |
| `employees.test.mjs` | 3104 | 4 | 員工 CRUD |
| `employees-bulk-import.test.mjs` | 3106 | 2 | 批次匯入（貼上、上傳） |
| `menus.test.mjs` | 3108 | 4 | 建菜單/詳細頁/結單/套用樣板 |
| `line-webhook.test.mjs` | — | 2 | Webhook 簽章驗證（HTTP 請求，不需瀏覽器） |
| `line-flex-message.test.mjs` | — | 3 | Flex Message 結構驗證（純函式單元測試） |
| `liff-order.test.mjs` | 3112 | 5 | LIFF 身分綁定 + 點餐全流程 |
| `cron-menu-maintenance.test.mjs` | — | 3 | 排程結單 + 提醒邏輯 |
| `menu-reminder-logic.test.mjs` | — | 3 | 提醒推播完整邏輯 |
| `assisted-order.test.mjs` | 3116 | 3 | 助理代客點餐 |
| `ai-menu-import.test.mjs` | 3118 | 4 | AI 辨識菜單全流程 |
| `stores.test.mjs` | 3120 | 5 | 店家 CRUD + 批次刪除 |
| `order-summary.test.mjs` | 3122 | 4 | 叫貨清單 + 對帳清單彙整 |
| `payroll.test.mjs` | 3124 | 4 | 薪資扣款產生 + CSV 匯出 |

### 穩定性技巧

- **同一時間只能跑一個 `next dev`**（Turbopack 鎖定 `.next` 目錄）；每個測試套件使用不同 port 避免衝突
- **`data-*` 屬性**作為穩定 E2E 選取器（`[data-menu-store]`、`[data-store-name]`）
- **React hydration 緩衝**：Server Action 按鈕需等 `document.readyState === "complete"` + 500ms，確保 React 已接管事件處理
- **殘留 process 清理**：Windows 上 `shell:true` 啟動的 `next dev` 需用 `taskkill /T /F` 砍整個程序樹

---

## 11. 部署環境

| 項目 | 說明 |
|------|------|
| 平台 | Vercel |
| 正式網址 | https://lunchbot-dun.vercel.app |
| Node.js 版本 | 20.x |
| 環境變數管理 | Vercel Dashboard → Environment Variables |
| 自動部署 | 推送到 GitHub `master` 分支自動觸發 |

---

## 12. 環境變數一覽

| 變數名稱 | 用途 | 放置位置 |
|----------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | `.env.local` + Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 前端 key（目前未直接使用） | `.env.local` + Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 後端 admin key（繞過 RLS） | `.env.local` + Vercel |
| `AUTH_SECRET` | HMAC session 簽章金鑰（任意隨機字串） | `.env.local` + Vercel |
| `ADMIN_EMAIL` | 後台帳號 Email | `.env.local` + Vercel |
| `ADMIN_PASSWORD_HASH` | 後台密碼 scrypt 雜湊 | `.env.local` + Vercel |
| `ADMIN_DISPLAY_NAME` | 後台顯示名稱 | `.env.local` + Vercel |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API 推播用 token | `.env.local` + Vercel |
| `LINE_CHANNEL_SECRET` | LINE Webhook 簽章驗證 | `.env.local` + Vercel |
| `LINE_GROUP_ID` | 推播目標 LINE 群組 ID | `.env.local` + Vercel |
| `NEXT_PUBLIC_LINE_LIFF_ID` | LIFF App ID（公開，可放前端） | `.env.local` + Vercel |
| `GEMINI_API_KEY` | Google Gemini AI API Key | `.env.local` + Vercel |
| `CRON_SECRET` | Vercel Cron 端點驗證密鑰 | `.env.local` + Vercel |

---

## 13. 資料流圖

### 建菜單流程

```
[助理] 填寫菜單表單 → menu-form.tsx（Client Component）
    ↓ form.action = createMenuAction
[Server] createMenuAction（Server Action）
    ↓
menus.ts → supabase.insert('menus', ...)
menu_items.ts → supabase.insert('menu_items', [...])
storeTemplates.ts → upsert（若勾選同步儲存）
    ↓
revalidatePath('/admin/menus') → 重新渲染列表
redirect('/admin/menus')
```

### 員工點餐流程（LIFF）

```
[員工 LINE App] 點擊菜單 Flex Message 中的「我要點餐」
    ↓
LIFF URL → /liff/order?menuId=xxx
    ↓
liff.init() → liff.getProfile() → { userId }
    ↓ 未綁定
/liff/order/actions.ts → bindEmployeeAction → employees 表更新 line_user_id
    ↓ 已綁定
getMenuById(menuId) → 顯示品項
    ↓
員工填寫數量 → submitOrderAction
    ↓
orders.upsertOrder() → orders + order_items（含 price 快照）
```

### 薪資扣款月結流程

```
[助理] 選擇帳期 → 點擊「產生扣款紀錄」
    ↓
generatePayrollDeductionsAction（Server Action）
    ↓
payrollDeductions.ts → generatePayrollDeductions(year, month)
    ↓
查詢該月所有已結單訂單（status='closed' 菜單下的 pending 訂單）
    ↓
新訂單 → INSERT payroll_deductions
已存在 pending 紀錄但金額不同 → UPDATE amount
已 exported 紀錄 → 跳過（不覆蓋）
    ↓
revalidatePath('/admin/payroll')
```
