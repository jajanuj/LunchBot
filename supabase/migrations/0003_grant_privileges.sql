-- ============================================================================
-- 0003_grant_privileges.sql
-- 補授 service_role 對所有資料表的存取權限。
--
-- 背景：手動用 SQL 建立的資料表，Supabase 不會像用 Dashboard Table Editor 那樣
-- 自動 GRANT 給各角色，導致即使使用 service_role key，PostgREST 仍回傳
-- "permission denied for table X"（PostgreSQL error 42501）。
--
-- anon / authenticated 角色刻意不授權（設計決策：所有存取一律走後端
-- API Route + service_role，不允許前端 anon key 直接讀寫任何資料表）。
-- ============================================================================

-- service_role 需要 schema 使用權 + 所有資料表/序列的完整存取權
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 設定預設權限，確保之後新增的資料表也自動有同樣授權
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
