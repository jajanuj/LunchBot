-- 在 order_items 加入 price 欄位，下單時一起儲存，
-- 避免菜單品項價格改變後歷史金額顯示失真。
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price INT NOT NULL DEFAULT 0;

-- 回填現有資料：從 menu_items 取得當前價格（歷史訂單近似值）
UPDATE order_items oi
SET price = mi.price
FROM menu_items mi
WHERE oi.menu_item_id = mi.id
  AND oi.price = 0;
