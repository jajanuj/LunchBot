#!/usr/bin/env node
// 驗證 Supabase 連線與資料表是否建立完成
// 執行方式：node --env-file=.env.local scripts/verify-supabase.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXPECTED_TABLES = [
  "employees",
  "store_templates",
  "template_items",
  "menus",
  "menu_items",
  "menu_ai_imports",
  "orders",
  "order_items",
  "payroll_deductions",
];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ 缺少環境變數：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function checkTable(tableName) {
  const { error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (!error) return { table: tableName, status: "ok" };

  const msg = error.message ?? error.code;
  // "relation does not exist" → table missing
  // 其他 error（permission denied 等）→ table 可能存在但 key 有問題
  const missing =
    msg.includes("relation") && msg.includes("does not exist");
  return { table: tableName, status: missing ? "missing" : "error", error: msg };
}

console.log(`\n🔍 Supabase 連線驗證（使用 @supabase/supabase-js + service_role key）`);
console.log(`   URL: ${SUPABASE_URL}\n`);

const results = await Promise.all(EXPECTED_TABLES.map(checkTable));

let allOk = true;
for (const r of results) {
  if (r.status === "ok") {
    console.log(`  ✅  ${r.table}`);
  } else if (r.status === "missing") {
    console.log(`  ❌  ${r.table}  — 資料表不存在`);
    allOk = false;
  } else {
    console.log(`  ⚠️  ${r.table}  — ${r.error}`);
    allOk = false;
  }
}

console.log("");
if (allOk) {
  console.log("🎉 所有資料表皆已建立，Supabase 連線正常！");
} else {
  console.log("⚠️  部分資料表有問題，請確認 SQL migration 是否已執行。");
  process.exit(1);
}
console.log("");
