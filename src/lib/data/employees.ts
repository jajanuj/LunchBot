// 員工名冊的「資料存取」抽象層。
//
// 目前狀態：Supabase 專案尚未建立，先用伺服器記憶體內的陣列頂著（dev server
// 重啟會重置，僅供開發/演示用；若部署到 Vercel 等 serverless 環境，不同
// instance 之間的記憶體不共享，資料會不一致 —— 這正是之後一定要換成
// Supabase 的原因，本機開發階段先不處理）。之後接上 Supabase 時，把這幾個
// 函式內部換成查詢 `employees` 資料表（見 docs/LunchBot-plan.md 4.1）即可，
// 呼叫端（Server Actions / 頁面）不需要改動。
//
// ⚠️ 用 globalThis 存資料，原因見 src/lib/data/menus.ts 開頭註解
// （Route Handler 跟 Server Action 在 dev 模式下可能各自有獨立模組實例）。
import { randomUUID } from "node:crypto";

export type Employee = {
  id: string;
  employeeName: string;
  lineUserId: string | null;
  boundAt: string | null;
};

declare global {
  var __lunchbot_employees__: Employee[] | undefined;
}

const employees: Employee[] = (globalThis.__lunchbot_employees__ ??= [
  { id: randomUUID(), employeeName: "王小明", lineUserId: "U_demo_1", boundAt: new Date().toISOString() },
  { id: randomUUID(), employeeName: "陳小華", lineUserId: null, boundAt: null },
  { id: randomUUID(), employeeName: "林小芳", lineUserId: null, boundAt: null },
]);

export async function listEmployees(): Promise<Employee[]> {
  return [...employees].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export type CreateEmployeeResult =
  | { ok: true; employee: Employee }
  | { ok: false; error: string };

export async function createEmployee(name: string): Promise<CreateEmployeeResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "姓名不可為空" };
  }
  if (trimmed.length > 20) {
    return { ok: false, error: "姓名長度不可超過 20 個字" };
  }
  if (employees.some((e) => e.employeeName === trimmed)) {
    return { ok: false, error: `「${trimmed}」已存在，姓名不可重複` };
  }

  const employee: Employee = {
    id: randomUUID(),
    employeeName: trimmed,
    lineUserId: null,
    boundAt: null,
  };
  employees.push(employee);
  return { ok: true, employee };
}

export type BulkCreateResult = {
  created: string[];
  skipped: { name: string; reason: string }[];
};

/**
 * 批次新增員工：逐筆套用跟 createEmployee 一樣的驗證規則，單筆失敗不會
 * 中斷整批，最後回報「成功新增哪些」「略過哪些及原因」。
 */
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

/** 尚未綁定 LINE 身分的員工名單，LIFF 頁面只能從這裡選，不可自由輸入姓名（防冒名）。 */
export async function listUnboundEmployees(): Promise<Employee[]> {
  return employees.filter((e) => e.lineUserId === null);
}

export async function findEmployeeByLineUserId(lineUserId: string): Promise<Employee | undefined> {
  return employees.find((e) => e.lineUserId === lineUserId);
}

export type BindEmployeeResult = { ok: true; employee: Employee } | { ok: false; error: string };

/**
 * 將 LINE 身分綁定到指定員工。一次性動作：已綁定的員工不可再被重新綁定，
 * 該 lineUserId 也不可重複綁定到別人（雙重防呆）。
 */
export async function bindEmployeeToLine(
  employeeId: string,
  lineUserId: string
): Promise<BindEmployeeResult> {
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) {
    return { ok: false, error: "找不到這位員工" };
  }
  if (employee.lineUserId !== null) {
    return { ok: false, error: "這位員工已經綁定過 LINE 身分了" };
  }
  if (employees.some((e) => e.lineUserId === lineUserId)) {
    return { ok: false, error: "這個 LINE 帳號已經綁定過別的員工了" };
  }

  employee.lineUserId = lineUserId;
  employee.boundAt = new Date().toISOString();
  return { ok: true, employee };
}

export async function deleteEmployee(id: string): Promise<void> {
  const index = employees.findIndex((e) => e.id === id);
  if (index !== -1) {
    employees.splice(index, 1);
  }
}
