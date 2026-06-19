import { supabase } from "../supabase";

export type PayrollDeductionStatus = "pending" | "exported";

export type PayrollDeduction = {
  id: string;
  employeeId: string;
  orderId: string;
  amount: number;
  billingPeriod: string;
  status: PayrollDeductionStatus;
};

export type PayrollEmployeeSummary = {
  employeeId: string;
  employeeName: string;
  totalAmount: number;
  orderCount: number;
  status: PayrollDeductionStatus;
};

type DeductionRow = {
  id: string;
  employee_id: string;
  order_id: string;
  amount: number;
  billing_period: string;
  status: string;
};

function toDeduction(row: DeductionRow): PayrollDeduction {
  return {
    id: row.id,
    employeeId: row.employee_id,
    orderId: row.order_id,
    amount: row.amount,
    billingPeriod: row.billing_period,
    status: row.status as PayrollDeductionStatus,
  };
}

/** 查詢指定帳期已有的扣款紀錄，加入員工姓名 */
export async function listPayrollDeductions(
  billingPeriod: string
): Promise<(PayrollDeduction & { employeeName: string })[]> {
  const { data, error } = await supabase
    .from("payroll_deductions")
    .select("id, employee_id, order_id, amount, billing_period, status, employees(employee_name)")
    .eq("billing_period", billingPeriod)
    .order("employee_id");
  if (error) throw new Error(error.message);

  type JoinedRow = DeductionRow & { employees: { employee_name: string } | { employee_name: string }[] | null };
  return (data as unknown as JoinedRow[]).map((row) => {
    const emp = row.employees;
    const employeeName = Array.isArray(emp)
      ? (emp[0]?.employee_name ?? "(未知)")
      : (emp?.employee_name ?? "(未知)");
    return { ...toDeduction(row), employeeName };
  });
}

/**
 * 產生指定帳期的扣款紀錄。
 * 依 menus.menu_date 的年月篩選 pending 訂單，對每筆尚未有扣款紀錄的 order 建立一筆。
 * 已存在（Unique order_id 衝突）的 order 直接忽略（idempotent）。
 */
export async function generatePayrollDeductions(billingPeriod: string): Promise<number> {
  // billingPeriod = "YYYY-MM"
  const [year, month] = billingPeriod.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month

  // 找出帳期內所有 pending 訂單（含菜單日期）
  const { data: orders, error: ordErr } = await supabase
    .from("orders")
    .select("id, employee_id, total_amount, menus!inner(menu_date)")
    .eq("status", "pending")
    .gte("menus.menu_date", startDate)
    .lte("menus.menu_date", endDate);
  if (ordErr) throw new Error(ordErr.message);

  if (!orders || orders.length === 0) return 0;

  // 查詢帳期內已有的扣款紀錄（含金額與狀態）
  const { data: existing, error: exErr } = await supabase
    .from("payroll_deductions")
    .select("order_id, amount, status")
    .eq("billing_period", billingPeriod);
  if (exErr) throw new Error(exErr.message);

  type ExistingRow = { order_id: string; amount: number; status: string };
  const existingMap = new Map<string, ExistingRow>(
    (existing ?? []).map((r: ExistingRow) => [r.order_id, r])
  );

  const orderList = orders as { id: string; employee_id: string; total_amount: number }[];

  // 尚無紀錄的 order → 新增
  const toInsert = orderList
    .filter((o) => !existingMap.has(o.id))
    .map((o) => ({
      employee_id: o.employee_id,
      order_id: o.id,
      amount: o.total_amount,
      billing_period: billingPeriod,
      status: "pending",
    }));

  // 已有 pending 紀錄但金額不同 → 更新（exported 不動）
  const toUpdate = orderList.filter((o) => {
    const ex = existingMap.get(o.id);
    return ex && ex.status === "pending" && ex.amount !== o.total_amount;
  });

  let changed = 0;

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("payroll_deductions").insert(toInsert);
    if (insertErr) throw new Error(insertErr.message);
    changed += toInsert.length;
  }

  for (const o of toUpdate) {
    const { error: updateErr } = await supabase
      .from("payroll_deductions")
      .update({ amount: o.total_amount, updated_at: new Date().toISOString() })
      .eq("order_id", o.id)
      .eq("status", "pending");
    if (updateErr) throw new Error(updateErr.message);
    changed++;
  }

  return changed;
}

/** 將指定帳期所有 pending 扣款紀錄標記為 exported */
export async function markPayrollExported(billingPeriod: string): Promise<number> {
  const { data, error } = await supabase
    .from("payroll_deductions")
    .update({ status: "exported", updated_at: new Date().toISOString() })
    .eq("billing_period", billingPeriod)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/** 彙整指定帳期的員工扣款摘要（每位員工合計） */
export function summarizeByEmployee(
  deductions: (PayrollDeduction & { employeeName: string })[]
): PayrollEmployeeSummary[] {
  const map = new Map<string, PayrollEmployeeSummary>();
  for (const d of deductions) {
    const cur = map.get(d.employeeId) ?? {
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      totalAmount: 0,
      orderCount: 0,
      status: d.status,
    };
    cur.totalAmount += d.amount;
    cur.orderCount += 1;
    // 若有任何一筆是 pending，整體視為 pending
    if (d.status === "pending") cur.status = "pending";
    map.set(d.employeeId, cur);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, "zh-TW")
  );
}
