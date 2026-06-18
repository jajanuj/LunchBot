import { supabase } from "../supabase";

export type Employee = {
  id: string;
  employeeName: string;
  lineUserId: string | null;
  boundAt: string | null;
};

type EmployeeRow = {
  id: string;
  employee_name: string;
  line_user_id: string | null;
  bound_at: string | null;
};

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeName: row.employee_name,
    lineUserId: row.line_user_id,
    boundAt: row.bound_at,
  };
}

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_name, line_user_id, bound_at")
    .order("employee_name");
  if (error) throw new Error(error.message);
  return (data as EmployeeRow[]).map(toEmployee);
}

export type CreateEmployeeResult =
  | { ok: true; employee: Employee }
  | { ok: false; error: string };

export async function createEmployee(name: string): Promise<CreateEmployeeResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "姓名不可為空" };
  if (trimmed.length > 20) return { ok: false, error: "姓名長度不可超過 20 個字" };

  const { data, error } = await supabase
    .from("employees")
    .insert({ employee_name: trimmed })
    .select("id, employee_name, line_user_id, bound_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `「${trimmed}」已存在，姓名不可重複` };
    }
    throw new Error(error.message);
  }
  return { ok: true, employee: toEmployee(data as EmployeeRow) };
}

export type BulkCreateResult = {
  created: string[];
  skipped: { name: string; reason: string }[];
};

export async function createEmployeesBulk(names: string[]): Promise<BulkCreateResult> {
  const created: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const rawName of names) {
    const result = await createEmployee(rawName);
    if (result.ok) {
      created.push(result.employee.employeeName);
    } else {
      skipped.push({ name: rawName.trim() || "(空白)", reason: result.error });
    }
  }

  return { created, skipped };
}

export async function listUnboundEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_name, line_user_id, bound_at")
    .is("line_user_id", null)
    .order("employee_name");
  if (error) throw new Error(error.message);
  return (data as EmployeeRow[]).map(toEmployee);
}

export async function findEmployeeByLineUserId(lineUserId: string): Promise<Employee | undefined> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_name, line_user_id, bound_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toEmployee(data as EmployeeRow) : undefined;
}

export type BindEmployeeResult = { ok: true; employee: Employee } | { ok: false; error: string };

export async function bindEmployeeToLine(
  employeeId: string,
  lineUserId: string
): Promise<BindEmployeeResult> {
  // 確認員工存在且尚未綁定
  const { data: existing, error: fetchErr } = await supabase
    .from("employees")
    .select("id, employee_name, line_user_id, bound_at")
    .eq("id", employeeId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) return { ok: false, error: "找不到這位員工" };
  if ((existing as EmployeeRow).line_user_id !== null) {
    return { ok: false, error: "這位員工已經綁定過 LINE 身分了" };
  }

  // 確認 lineUserId 沒有被別人用
  const { data: taken, error: takenErr } = await supabase
    .from("employees")
    .select("id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (takenErr) throw new Error(takenErr.message);
  if (taken) return { ok: false, error: "這個 LINE 帳號已經綁定過別的員工了" };

  const { data: updated, error: updateErr } = await supabase
    .from("employees")
    .update({ line_user_id: lineUserId, bound_at: new Date().toISOString() })
    .eq("id", employeeId)
    .select("id, employee_name, line_user_id, bound_at")
    .single();
  if (updateErr) throw new Error(updateErr.message);
  return { ok: true, employee: toEmployee(updated as EmployeeRow) };
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEmployeesBatch(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("employees").delete().in("id", ids);
  if (error) throw new Error(error.message);
}
