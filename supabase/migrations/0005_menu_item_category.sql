-- 新增品項類別欄位，用於 LIFF 點餐頁顯示冰量/糖量選項
-- 說明：null = 不指定（沿用備註欄位），food = 食物，drink = 飲料
-- 手動在 Supabase Dashboard > SQL Editor 執行
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN ('food', 'drink'));
