-- 在 menus 表加入菜單類型欄位（食物店 / 飲料店）
-- 決策：分類綁定整張菜單而非個別品項，點餐頁依此決定是否顯示冰量/糖量選鈕
ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS menu_type TEXT
  CHECK (menu_type IN ('food', 'drink'));
