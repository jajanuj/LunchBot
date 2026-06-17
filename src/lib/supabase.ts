import { createClient } from "@supabase/supabase-js";

// 伺服器端專用的 admin client，使用 service_role key 繞過 RLS。
// 絕對不能暴露給瀏覽器端（此檔只會在 Server Action / API Route 裡被 import）。
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
