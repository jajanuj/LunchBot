# LunchBot 技術棧與學習大綱

> 版本：1.0　更新日期：2026-06-27

本文件列出本專案使用到的所有技術，以及自學時建議的學習大綱與重點。

---

## 目錄

1. [技術棧總覽](#1-技術棧總覽)
2. [TypeScript](#2-typescript)
3. [React 19](#3-react-19)
4. [Next.js 16（App Router）](#4-nextjs-16app-router)
5. [Tailwind CSS 4](#5-tailwind-css-4)
6. [Supabase](#6-supabase)
7. [PostgreSQL（透過 Supabase）](#7-postgresql透過-supabase)
8. [Node.js 內建模組（crypto）](#8-nodejs-內建模組crypto)
9. [LINE 開發（Messaging API + LIFF）](#9-line-開發messaging-api--liff)
10. [Google Gemini AI API](#10-google-gemini-ai-api)
11. [Puppeteer（E2E 測試）](#11-puppeteere2e-測試)
12. [Vercel（部署 + Cron）](#12-vercel部署--cron)
13. [ESLint](#13-eslint)
14. [建議學習順序](#14-建議學習順序)

---

## 1. 技術棧總覽

| 分類 | 技術 | 版本 | 用途 |
|------|------|------|------|
| 語言 | TypeScript | 5.x | 全專案型別安全 |
| UI 框架 | React | 19.x | 元件化 UI |
| 全端框架 | Next.js | 16.x | 路由、SSR、Server Action、API |
| 樣式 | Tailwind CSS | 4.x | 原子化 CSS |
| 資料庫 | Supabase（PostgreSQL） | 2.x | 雲端 SQL 資料庫 |
| 認證 | Node.js crypto（HMAC） | 內建 | Session Cookie 簽章 |
| 訊息推播 | LINE Messaging API | 11.x | Flex Message 推播至群組 |
| 員工點餐 | LINE LIFF | 2.x | 在 LINE 內嵌瀏覽器點餐 |
| AI 辨識 | Google Gemini AI | gemini-2.5-flash | 菜單圖片辨識品項 |
| E2E 測試 | Puppeteer | 25.x | 自動化瀏覽器測試 |
| 部署 | Vercel | — | CI/CD + Serverless + Cron |
| 程式碼品質 | ESLint | 9.x | 靜態分析 |

---

## 2. TypeScript

### 在本專案的應用

- 所有 `.ts` / `.tsx` 檔案都使用 TypeScript
- 資料層（`src/lib/data/*.ts`）定義介面（interface）確保 Supabase 回傳型別正確
- Server Action 函式簽章、React 元件 props 都有明確型別
- `as const` 用於常數物件（如狀態對應樣式表）

### 學習大綱

#### 基礎（必學）
- [ ] 基本型別：`string`、`number`、`boolean`、`null`、`undefined`、`void`
- [ ] 型別注解：變數、函式參數、回傳值
- [ ] 介面（`interface`）與型別別名（`type`）的差異
- [ ] 陣列型別：`string[]`、`Array<T>`
- [ ] 物件型別、可選屬性（`?`）、唯讀（`readonly`）
- [ ] Union type（`|`）、Intersection type（`&`）

#### 進階（本專案有用到）
- [ ] 泛型（Generics）：`function fn<T>(arg: T): T`
- [ ] `as` 型別斷言、`!` non-null 斷言
- [ ] `typeof`、`keyof`、`ReturnType<T>`、`Pick<T, K>`
- [ ] `Partial<T>`、`Required<T>`、`Omit<T, K>`
- [ ] 列舉（`enum`）vs `as const` 常數物件
- [ ] 型別守衛（Type Guard）

#### 學習資源
- 官方文件：https://www.typescriptlang.org/docs/handbook/
- TypeScript Playground：https://www.typescriptlang.org/play（邊學邊試）

---

## 3. React 19

### 在本專案的應用

- Client Component 使用 `useState`、`useTransition`、`useRouter`
- Server Component 直接 `async` 函式 + `await` 讀取資料庫（React 19 新特性）
- `useTransition` 用於 Server Action 非同步過程中顯示「處理中」狀態
- `ref` callback 用於控制 checkbox 的 `indeterminate` 狀態

### 學習大綱

#### 基礎（必學）
- [ ] JSX 語法：什麼是 JSX、與 HTML 的差異
- [ ] 函式元件（Function Component）
- [ ] Props：傳入資料、預設值、解構
- [ ] State：`useState`、更新 state、re-render 機制
- [ ] 事件處理：`onClick`、`onChange`、`onSubmit`
- [ ] 條件渲染：三元運算子、`&&` 短路
- [ ] 列表渲染：`.map()` + `key` 屬性

#### 進階（本專案有用到）
- [ ] `useEffect`：副作用、清理函式、依賴陣列
- [ ] `useRef`：操作 DOM 元素（本專案用於 checkbox indeterminate）
- [ ] `useTransition`：標記非緊急更新，顯示 pending 狀態
- [ ] `useRouter`（Next.js 提供）：程式導向路由
- [ ] React 19 Server Component：async 元件直接讀取資料
- [ ] `React.Fragment`（`<>`）：避免多餘 wrapper DOM

#### 學習資源
- 官方文件：https://react.dev/learn（互動式教學）

---

## 4. Next.js 16（App Router）

### 在本專案的應用

- **App Router**：全部頁面在 `src/app/` 下，資料夾即路由
- **動態路由**：`[id]` 資料夾對應 `/admin/menus/abc123` 等動態路徑
- **Layout**：`layout.tsx` 定義共用外框（導覽列、認證保護）
- **Server Component**：`page.tsx` 預設是 Server Component，直接 `await` 讀 DB
- **Client Component**：需要互動狀態的元件加 `"use client"`
- **Server Action**：`actions.ts` 加 `"use server"`，直接在伺服器執行
- **Route Handler**：`route.ts` 建立 API 端點
- **Middleware（proxy.ts）**：Next.js 16 將 `middleware.ts` 改名為 `proxy.ts`
- **`revalidatePath()`**：Server Action 完成後讓指定頁面重新抓取資料
- **Turbopack**：Next.js 16 預設開發用打包工具（比 Webpack 快）

### 學習大綱

#### 基礎（必學）
- [ ] App Router 目錄結構：`page.tsx`、`layout.tsx`、`loading.tsx`、`error.tsx`
- [ ] 靜態路由 vs 動態路由（`[id]`、`[...slug]`）
- [ ] `Link` 元件 vs `useRouter` 的使用時機
- [ ] `Image` 元件：自動圖片優化
- [ ] `metadata` 物件：SEO 設定

#### 核心概念（本專案重點）
- [ ] **Server Component vs Client Component**：何時用哪個、各自限制
- [ ] **Server Action**：`"use server"` 函式、`form.action`、`useTransition` 搭配
- [ ] **Route Handler**：`GET`/`POST` 函式、`NextRequest`、`NextResponse`
- [ ] **Middleware（proxy.ts）**：路由攔截、`NextResponse.redirect()`、`matcher` 設定
- [ ] **`revalidatePath()` / `revalidateTag()`**：快取失效機制
- [ ] **`searchParams` / `params`**：頁面路由參數取得方式

#### 資料抓取
- [ ] Server Component 直接 `fetch` 或呼叫資料函式
- [ ] `Suspense` + `loading.tsx`：串流渲染
- [ ] `cache()` 函式：Request 內快取

#### 學習資源
- 官方文件：https://nextjs.org/docs/app
- 互動課程：https://nextjs.org/learn

---

## 5. Tailwind CSS 4

### 在本專案的應用

- 全部樣式用 Tailwind 原子類別，無自訂 CSS 檔案（除 `globals.css` 少量全域設定）
- **深色模式**：`dark:` 前綴，依系統設定自動切換
- **響應式**：`sm:`、`lg:` 前綴，手機 1 欄 / 平板 2 欄 / 桌機 3 欄
- **Grid 卡片排版**：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
- **Sticky 定位**：LIFF 點餐頁的頂部固定金額列（`sticky top-0`）
- **`hidden`**：保留舊 table DOM 但不顯示（`display: none`）

### 學習大綱

#### 基礎（必學）
- [ ] 如何在專案引入 Tailwind CSS
- [ ] 核心概念：原子類別（Utility-First）
- [ ] 常用類別：`flex`、`grid`、`p-`、`m-`、`w-`、`h-`、`text-`、`bg-`、`border`
- [ ] 顏色系統：`gray-100`、`red-600` 等色階
- [ ] 版面排版：`flex`、`grid`、`gap-`、`items-center`、`justify-between`

#### 進階（本專案有用到）
- [ ] 響應式前綴：`sm:`、`md:`、`lg:`、`xl:`
- [ ] 深色模式前綴：`dark:`
- [ ] 狀態前綴：`hover:`、`focus:`、`disabled:`
- [ ] `position`：`relative`、`absolute`、`sticky`、`fixed`
- [ ] Tailwind v4 新語法：CSS 變數整合、`@apply` 用法變更

#### 學習資源
- 官方文件：https://tailwindcss.com/docs
- 互動練習：https://play.tailwindcss.com

---

## 6. Supabase

### 在本專案的應用

- **PostgreSQL 資料庫**：存放所有業務資料（9 張資料表）
- **Storage**：存放菜單 AI 辨識上傳的圖片（`menu-images` bucket）
- **PostgREST API**：Supabase 自動把 PostgreSQL 包成 REST API
- **`supabase-js`**：官方 JavaScript/TypeScript 客戶端
- **`service_role key`**：後端使用，繞過 RLS，有完整存取權限
- **Migration**：版控資料庫 Schema 變更（`supabase/migrations/` 目錄）

### 學習大綱

#### 基礎（必學）
- [ ] Supabase 是什麼：BaaS（Backend as a Service）概念
- [ ] 建立 Supabase 專案、取得 URL 和 API Key
- [ ] `createClient(url, key)` 初始化
- [ ] 基本查詢：`.from('table').select('*')`
- [ ] 條件篩選：`.eq('field', value)`、`.in('field', [...])`、`.gte()`、`.lte()`
- [ ] 新增：`.insert({ ... })`
- [ ] 更新：`.update({ ... }).eq(...)`
- [ ] 刪除：`.delete().eq(...)`
- [ ] upsert：`.upsert({ ... }, { onConflict: 'field' })`

#### 進階（本專案有用到）
- [ ] **Join 查詢**：`select('*, menu_items(id, item_name, price)')` PostgREST 外鍵關聯語法
- [ ] **Row Level Security（RLS）**：什麼是 RLS、`anon` vs `authenticated` vs `service_role` 角色
- [ ] **`service_role key`**：後端繞過 RLS 的正確做法、不能暴露給前端的原因
- [ ] **Storage**：上傳檔案、取得公開 URL
- [ ] **Migration**：用 SQL 檔案版控 Schema 變更
- [ ] **`order()`、`limit()`**：排序與分頁
- [ ] **錯誤處理**：`{ data, error }` 解構、检查 `error !== null`

#### 學習資源
- 官方文件：https://supabase.com/docs
- JavaScript SDK：https://supabase.com/docs/reference/javascript

---

## 7. PostgreSQL（透過 Supabase）

### 在本專案的應用

- 9 張資料表，有外鍵關聯與 `ON DELETE CASCADE`
- `uuid` 主鍵（`gen_random_uuid()`）
- `UNIQUE` 約束（如 `(menu_date, store_name)`）
- `CHECK` 約束（如 `status IN ('open', 'closed', 'cancelled')`）
- `INDEX` 加速常用查詢欄位
- `TRIGGER`：`updated_at` 自動更新（`BEFORE UPDATE` trigger）
- `plpgsql`：trigger 函式語言
- `JSONB`：儲存 AI 辨識原始 response

### 學習大綱

#### 基礎（必學）
- [ ] SQL 基礎：`SELECT`、`FROM`、`WHERE`、`ORDER BY`、`LIMIT`
- [ ] `INSERT INTO`、`UPDATE`、`DELETE FROM`
- [ ] 資料型別：`TEXT`、`VARCHAR`、`INT`、`BOOLEAN`、`DATE`、`TIMESTAMPTZ`、`UUID`
- [ ] `CREATE TABLE`：欄位定義、`NOT NULL`、`DEFAULT`
- [ ] `PRIMARY KEY`、`FOREIGN KEY`、`REFERENCES`
- [ ] `JOIN`：`INNER JOIN`、`LEFT JOIN`

#### 進階（本專案有用到）
- [ ] `UNIQUE` 約束、`CHECK` 約束
- [ ] `ON DELETE CASCADE`：父資料刪除時自動刪子資料
- [ ] `INDEX`：查詢效能優化，何時加 index
- [ ] `TRIGGER` + `FUNCTION`：自動化觸發邏輯（本專案用於 `updated_at`）
- [ ] `JSONB`：JSON 欄位型別，可查詢內部欄位
- [ ] UUID：`gen_random_uuid()`、`pgcrypto` 擴充
- [ ] `TIMESTAMPTZ`：含時區的時間戳，與 `TIMESTAMP` 的差異
- [ ] `ON CONFLICT ... DO UPDATE`（upsert 語法）

#### 學習資源
- PostgreSQL 官方文件：https://www.postgresql.org/docs/
- 互動練習：https://sqlzoo.net / https://pgexercises.com

---

## 8. Node.js 內建模組（crypto）

### 在本專案的應用

- `createHmac('sha256', secret).update(data).digest('hex')`：HMAC-SHA256 簽章
- `timingSafeEqual(a, b)`：防 timing attack 的安全比較
- `Buffer.from(str, 'base64url')`、`.toString('base64url')`：Base64url 編解碼
- `scrypt`（用於密碼雜湊）：`scryptSync(password, salt, 64)`

### 學習大綱

#### 基礎
- [ ] Node.js 內建模組概念（不需 npm install）
- [ ] `Buffer`：二進位資料處理，`Buffer.from()`、`.toString()`
- [ ] Base64 / Base64url 編碼用途

#### 密碼學基礎（本專案用到）
- [ ] **Hash（雜湊）**：單向、不可逆；`sha256`、`sha512`
- [ ] **HMAC**：帶密鑰的 Hash，用於驗證資料完整性與來源
  - `createHmac(algorithm, key).update(data).digest(encoding)`
- [ ] **Timing Attack**：比對字串長度不同時的時間差攻擊；`timingSafeEqual` 的重要性
- [ ] **scrypt / bcrypt**：密碼雜湊（故意慢，防暴力破解）
- [ ] **對稱加密 vs 非對稱加密**：概念理解即可

#### 學習資源
- Node.js crypto 文件：https://nodejs.org/api/crypto.html

---

## 9. LINE 開發（Messaging API + LIFF）

### 在本專案的應用

**Messaging API（`@line/bot-sdk`）：**
- `messagingApi.MessagingApiClient`：推播訊息的 client
- `client.pushMessage({ to, messages })`：發送至群組/個人
- Flex Message：JSON 結構化訊息（Carousel + Bubble）
- Webhook 簽章驗證：`validateSignature(body, channelSecret, signature)`

**LIFF（`@line/liff`）：**
- `liff.init({ liffId })`：初始化 LIFF SDK
- `liff.getProfile()`：取得 LINE 使用者資訊（userId、displayName）
- `liff.isLoggedIn()`：確認是否已登入
- `liff.login({ redirectUri })`：導向 LINE 登入

### 學習大綱

#### LINE 基礎概念
- [ ] LINE Developers Console：Provider、Channel 的關係
- [ ] Messaging API Channel vs LINE Login Channel 的差異
- [ ] Channel Access Token / Channel Secret 用途
- [ ] Webhook：LINE 平台推送事件給你的伺服器

#### Messaging API
- [ ] 訊息類型：Text、Image、Flex Message
- [ ] `pushMessage`（主動推播）vs `replyMessage`（回覆）的差異
- [ ] **Flex Message**：JSON 格式、Bubble / Carousel 結構、Simulator 使用
  - 官方 Simulator：https://developers.line.biz/flex-simulator/
- [ ] Webhook 事件：Message event、Join event、Follow event
- [ ] Webhook 簽章驗證：防止假冒 LINE 平台的請求

#### LIFF
- [ ] LIFF 是什麼：在 LINE 內嵌瀏覽器開啟的網頁
- [ ] LIFF ID 取得：在 LINE Login Channel 底下建立 LIFF App
- [ ] `liff.init()` → `liff.getProfile()` 基本流程
- [ ] LIFF URL 格式：`https://liff.line.me/{LIFF_ID}`
- [ ] 本機開發限制：需要 https（用 ngrok 建立臨時網址）

#### 學習資源
- LINE Developers 文件：https://developers.line.biz/en/docs/
- Flex Message 文件：https://developers.line.biz/en/docs/messaging-api/flex-message-overview/

---

## 10. Google Gemini AI API

### 在本專案的應用

- 模型：`gemini-2.5-flash`（多模態，支援圖片輸入）
- 呼叫方式：REST API（fetch 直接呼叫，未使用官方 SDK）
- 輸入：圖片（base64）+ 文字 prompt
- 輸出：JSON 格式的品項清單（`[{ name, price }]`）
- 錯誤重試：429 / 503 最多重試 3 次

### 學習大綱

#### AI / LLM 基礎概念
- [ ] LLM（大型語言模型）是什麼
- [ ] Token：輸入/輸出計費單位
- [ ] Prompt Engineering：如何寫有效的指令
- [ ] Temperature：控制回應的創意程度
- [ ] 多模態（Multimodal）：同時處理文字 + 圖片

#### Gemini API 實作
- [ ] 取得 API Key（Google AI Studio）
- [ ] REST API 呼叫格式：endpoint、headers、request body
- [ ] `generationConfig`：`responseMimeType: "application/json"`（強制 JSON 輸出）
- [ ] `inlineData`：圖片 base64 編碼傳入方式
- [ ] 錯誤碼：`429 RESOURCE_EXHAUSTED`（每日額度耗盡）、`503`
- [ ] 每個模型有獨立的每日免費額度

#### 學習資源
- Google AI Studio：https://aistudio.google.com
- Gemini API 文件：https://ai.google.dev/gemini-api/docs

---

## 11. Puppeteer（E2E 測試）

### 在本專案的應用

- 啟動 headless Chrome 模擬真實用戶操作
- `page.goto(url, { waitUntil: 'networkidle0' })`：等頁面完全載入
- `page.waitForSelector(selector)`：等待元素出現
- `page.waitForFunction(fn)`：等待自訂條件（如 `document.readyState === "complete"`）
- `page.evaluate(fn)`：在瀏覽器端執行 JavaScript
- `page.evaluateHandle(fn)`：取得瀏覽器端的元素 handle
- `page.$eval(selector, fn)`：取得元素屬性值
- `page.$$eval(selector, fn)`：取得多個元素
- `page.click(selector)`：點擊按鈕
- `page.type(selector, text)`：輸入文字
- `page.select(selector, value)`：選擇 select 選項

### 學習大綱

#### 基礎
- [ ] E2E 測試是什麼：模擬真實用戶操作的整合測試
- [ ] Headless Browser：無 UI 的瀏覽器，測試用
- [ ] `puppeteer.launch()` vs `puppeteer.connect()`
- [ ] `browser.newPage()`、`page.goto()`
- [ ] 等待策略：`waitForSelector`、`waitForNavigation`、`waitForNetworkIdle`
- [ ] 元素操作：`click()`、`type()`、`select()`
- [ ] 截圖：`page.screenshot({ path: 'shot.png' })`

#### 進階（本專案用到）
- [ ] `page.evaluate()` vs `page.evaluateHandle()`：在瀏覽器端執行程式碼
- [ ] `ElementHandle`：瀏覽器端元素的 Node.js 代理物件
- [ ] `page.waitForFunction()`：等待自訂條件
- [ ] `page.on('dialog', handler)`：處理 alert / confirm 對話框
- [ ] 選取器策略：CSS 選取器、`data-*` 屬性作為穩定選取器
- [ ] **React hydration 問題**：為何 `waitForNetworkIdle` 不夠、需要額外等待
- [ ] Windows 程序管理：`spawn({ shell: true })` 產生的程序樹、`taskkill /T /F`

#### 學習資源
- 官方文件：https://pptr.dev

---

## 12. Vercel（部署 + Cron）

### 在本專案的應用

- Next.js 應用程式部署（GitHub 推送自動部署）
- **Serverless Function**：每個 API Route 和 Server Action 都是獨立的 Serverless Function
- **Edge Network**：CDN 加速靜態資源
- **Environment Variables**：在 Vercel Dashboard 設定正式環境變數
- **Vercel Cron**：定時執行 `vercel.json` 設定的端點

### 學習大綱

#### 基礎
- [ ] Vercel 是什麼：Serverless 部署平台
- [ ] 連接 GitHub 倉庫、自動部署流程
- [ ] 環境變數設定（Vercel Dashboard vs `.env.local`）
- [ ] 預覽部署（每個 PR 自動產生預覽網址）
- [ ] 方案限制：Hobby vs Pro（Cron 頻率、執行時間上限）

#### Serverless 概念
- [ ] Serverless Function 是什麼：無需管理伺服器的函式執行環境
- [ ] Cold Start（冷啟動）：第一次呼叫較慢的原因
- [ ] 執行時間上限：Hobby 方案預設 10 秒

#### Vercel Cron
- [ ] `vercel.json` 的 `crons` 設定格式
- [ ] Cron expression：`0 22 * * *` 的意思（分 時 日 月 星期）
- [ ] 安全性：用 `Authorization: Bearer {CRON_SECRET}` 驗證呼叫者

#### 學習資源
- 官方文件：https://vercel.com/docs
- Cron Jobs：https://vercel.com/docs/cron-jobs

---

## 13. ESLint

### 在本專案的應用

- 使用 `eslint-config-next`（Next.js 官方推薦規則集）
- ESLint 9 新設定格式（`eslint.config.js`）
- 自動檢查：未使用變數、React hooks 規則、import 順序等

### 學習大綱

#### 基礎
- [ ] ESLint 是什麼：JavaScript/TypeScript 靜態程式碼分析工具
- [ ] 設定檔：`eslint.config.js`（v9 新格式）vs `.eslintrc`（舊格式）
- [ ] 規則等級：`error`、`warn`、`off`
- [ ] `// eslint-disable-next-line`：行級停用規則

#### Next.js 搭配使用
- [ ] `eslint-config-next` 提供的規則集
- [ ] `next/image` 規則：強制使用 `<Image>` 元件
- [ ] `react-hooks` 規則：`hooks` 只能在元件最上層呼叫
- [ ] `npm run lint`：執行 lint 檢查

---

## 14. 建議學習順序

根據本專案的依賴關係，建議以下順序學習：

### 第一階段：基礎（2-4 週）
1. **TypeScript 基礎**（型別、interface、泛型）
2. **React 19 基礎**（JSX、useState、useEffect、Props）
3. **HTML + CSS 基礎**（如果還不熟）
4. **Tailwind CSS**（原子類別、響應式、深色模式）

### 第二階段：全端開發（3-5 週）
5. **Next.js App Router**（重點：Server Component、Server Action、Route Handler）
6. **PostgreSQL 基礎 SQL**（SELECT、JOIN、CRUD）
7. **Supabase**（建立專案、`supabase-js` 操作）

### 第三階段：外部服務整合（2-3 週）
8. **Vercel 部署**（連接 GitHub、環境變數、Cron）
9. **LINE Messaging API**（Flex Message、Webhook）
10. **LINE LIFF**（初始化、取得用戶資訊）
11. **Google Gemini AI API**（呼叫方式、Prompt 設計）

### 第四階段：進階與品質（1-2 週）
12. **Node.js crypto**（HMAC、Base64url、密碼安全）
13. **Puppeteer E2E 測試**（自動化瀏覽器測試）
14. **ESLint**（程式碼品質工具）

---

> 💡 **學習建議：** 不需要等每個技術都學完再開始下一個，邊做邊學效果最好。可以先用本專案的程式碼做對照，遇到不懂的語法再去查官方文件，理解後立刻在程式碼裡找到對應的用法。
