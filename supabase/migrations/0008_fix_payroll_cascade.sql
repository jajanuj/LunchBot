-- 修正 payroll_deductions.order_id 外鍵缺少 ON DELETE CASCADE 的問題
-- 症狀：刪除菜單時出現 "violates foreign key constraint payroll_deductions_order_id_fkey"
ALTER TABLE payroll_deductions
  DROP CONSTRAINT IF EXISTS payroll_deductions_order_id_fkey;

ALTER TABLE payroll_deductions
  ADD CONSTRAINT payroll_deductions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 同時確認 employee_id 的外鍵也正確
ALTER TABLE payroll_deductions
  DROP CONSTRAINT IF EXISTS payroll_deductions_employee_id_fkey;

ALTER TABLE payroll_deductions
  ADD CONSTRAINT payroll_deductions_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
