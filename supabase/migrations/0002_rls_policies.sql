-- ============================================================================
-- 0002_rls_policies.sql
-- 對應 docs/LunchBot-plan.md 第 4.10 節「Row Level Security 政策原則」
--
-- 重要架構決策（請見本次回覆說明，待老闆確認）：
--   員工身分來自 LINE LIFF（line_user_id），並非 Supabase Auth，
--   因此前端無法透過 Supabase Auth 的 auth.uid() 取得「目前是哪位員工」。
--   為避免額外實作自訂 JWT / Custom Claims 的複雜度與風險，採用以下設計：
--
--   - 瀏覽器端（LIFF 頁面）一律不直接呼叫 Supabase，所有讀寫都先打到
--     Next.js API Route，由伺服器驗證 LINE 身分後，使用 service_role key
--     存取 Supabase（service_role 預設會略過 RLS）。
--   - `anon` / `authenticated` 角色（前端若意外拿到 anon key）一律無任何
--     讀寫權限（預設拒絕），RLS 在此僅作為「縱深防禦」：即使 anon key
--     不慎外流，外部也完全無法讀寫任何資料表。
--   - 所有「員工只能看自己的訂單」「截止後不可修改」等業務規則，
--     實際上由 Next.js API Route 的程式碼邏輯把關，而非資料庫角色。
--
--   此設計讓 LIFF 與後台都以同一套「Server-side API Route + service_role」
--   模式運作，較單純、較不易出錯；缺點是所有資料存取都要繞經 Next.js
--   伺服器，無法用 Supabase Realtime 直接訂閱（若未來需要即時更新，
--   屆時再評估是否導入自訂 JWT）。
-- ============================================================================

alter table employees enable row level security;
alter table store_templates enable row level security;
alter table template_items enable row level security;
alter table menus enable row level security;
alter table menu_items enable row level security;
alter table menu_ai_imports enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payroll_deductions enable row level security;

-- 刻意不建立任何給 anon / authenticated 角色的 policy：
-- 在未建立任何 policy 的情況下，RLS 預設「拒絕所有存取」，
-- 僅 service_role（繞過 RLS）可讀寫，符合上述架構決策。
