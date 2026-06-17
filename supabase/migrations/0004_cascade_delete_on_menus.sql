-- 修正 orders 與 order_items 的外鍵，改為 ON DELETE CASCADE。
-- 刪除菜單時，相關訂單與訂單品項會一併自動刪除，不再拋出 foreign key 違反錯誤。
--
-- 套用方式：
--   Supabase Dashboard → SQL Editor → 貼上執行
--   或：supabase db push

-- orders.menu_id → menus.id（加 CASCADE）
alter table orders
  drop constraint orders_menu_id_fkey,
  add constraint orders_menu_id_fkey
    foreign key (menu_id) references menus(id) on delete cascade;

-- order_items.menu_item_id → menu_items.id（加 CASCADE）
-- 刪除 menu_item 時，相關 order_items 也一起清除。
alter table order_items
  drop constraint order_items_menu_item_id_fkey,
  add constraint order_items_menu_item_id_fkey
    foreign key (menu_item_id) references menu_items(id) on delete cascade;
