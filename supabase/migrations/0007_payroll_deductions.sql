-- 薪資扣款紀錄表（對應計劃文件 4.9）
CREATE TABLE IF NOT EXISTS payroll_deductions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount          INT  NOT NULL CHECK (amount >= 0),
  billing_period  VARCHAR(7) NOT NULL, -- YYYY-MM
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'exported')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_deductions_billing_period
  ON payroll_deductions (billing_period);
