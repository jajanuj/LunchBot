-- ============================================================================
-- 0001_init_schema.sql
-- 對應 docs/LunchBot-plan.md 第 4 節「資料庫綱要設計」
--
-- 套用方式：
--   1. 若已建立 Supabase 專案並安裝 Supabase CLI：
--        supabase link --project-ref <your-project-ref>
--        supabase db push
--   2. 或直接將本檔內容貼到 Supabase Dashboard 的 SQL Editor 執行。
--
-- 本檔僅建立資料表與共通的 updated_at 自動更新機制；
-- Row Level Security 政策另見 0002_rls_policies.sql。
-- ============================================================================

-- gen_random_uuid() 所需的擴充套件（Supabase 預設專案多已啟用，此處保險起見再次宣告）
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 共通機制：updated_at 自動更新 trigger function
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- 4.1 員工資料表 (employees)
-- ----------------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  line_user_id varchar(50) unique,
  employee_name varchar(20) not null unique,
  bound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_employees_updated_at
  before update on employees
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.2 店家歷史樣板表 (store_templates)
-- ----------------------------------------------------------------------------
create table store_templates (
  id uuid primary key default gen_random_uuid(),
  store_name varchar(100) not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_store_templates_updated_at
  before update on store_templates
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.3 樣板品項明細表 (template_items)
-- ----------------------------------------------------------------------------
create table template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references store_templates(id) on delete cascade,
  item_name varchar(100) not null,
  price int not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_template_items_template_id on template_items(template_id);

create trigger trg_template_items_updated_at
  before update on template_items
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.4 每日菜單表 (menus)
-- ----------------------------------------------------------------------------
create table menus (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null,
  session_name varchar(50),
  store_name varchar(100) not null,
  cutoff_time timestamptz not null,
  reminder_minutes_before int,
  reminder_sent_at timestamptz,
  status varchar(20) not null default 'open'
    check (status in ('open', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_menus_date_store unique (menu_date, store_name)
);

create index idx_menus_status on menus(status);
create index idx_menus_menu_date on menus(menu_date);

create trigger trg_menus_updated_at
  before update on menus
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.5 菜單品項明細表 (menu_items)
-- ----------------------------------------------------------------------------
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references menus(id) on delete cascade,
  item_name varchar(100) not null,
  price int not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_menu_items_menu_id on menu_items(menu_id);

create trigger trg_menu_items_updated_at
  before update on menu_items
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.6 AI 辨識原始結果留存表 (menu_ai_imports)
-- ----------------------------------------------------------------------------
create table menu_ai_imports (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid references menus(id) on delete set null,
  store_name varchar(100) not null,
  image_path text not null,
  raw_response jsonb not null,
  reviewed_items jsonb,
  reviewed_by varchar(20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_menu_ai_imports_menu_id on menu_ai_imports(menu_id);

create trigger trg_menu_ai_imports_updated_at
  before update on menu_ai_imports
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.7 訂單主檔表 (orders)
-- ----------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references menus(id),
  employee_id uuid not null references employees(id),
  total_amount int not null default 0,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'cancelled')),
  source varchar(20) not null default 'self'
    check (source in ('self', 'assisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_orders_menu_employee unique (menu_id, employee_id)
);

create index idx_orders_menu_id on orders(menu_id);
create index idx_orders_employee_id on orders(employee_id);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.8 訂單品項明細表 (order_items)
-- ----------------------------------------------------------------------------
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  quantity int not null default 1,
  custom_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_menu_item_id on order_items(menu_item_id);

create trigger trg_order_items_updated_at
  before update on order_items
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4.9 薪資扣款紀錄表 (payroll_deductions)
-- ----------------------------------------------------------------------------
create table payroll_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  order_id uuid not null references orders(id),
  amount int not null,
  billing_period varchar(7) not null,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'exported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_payroll_deductions_order unique (order_id)
);

create index idx_payroll_deductions_employee_id on payroll_deductions(employee_id);
create index idx_payroll_deductions_billing_period on payroll_deductions(billing_period);

create trigger trg_payroll_deductions_updated_at
  before update on payroll_deductions
  for each row execute function set_updated_at();
