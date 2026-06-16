// 員工名冊的「資料存取」抽象層。
//
// 目前狀態：Supabase 專案尚未建立，先用伺服器記憶體內的陣列頂著（dev server
// 重啟會重置，僅供開發/演示用；若部署到 Vercel 等 serverless 環境，不同
// instance 之間的記憶體不共享，資料會不一致 —— 這正是之後一定要換成
// Supabase 的原因，本機開發階段先不處理）。之後接上 Supabase 時，把這幾個
// 函式內部換成查詢 `employees` 資料表（見 docs/LunchBot-plan.md 4.1）即可，
// 呼叫端（Server Actions / 頁面）不需要改動。
import { randomUUID } from "node:crypto";

export type Employee = {
  id: string;
  employeeName: string;
  lineUserId: string | null;
  boundAt: string | null;
};

const employees: Employee[] = [
  { id: randomUUID(), employeeName: "王小明", lineUserId: "U_demo_1", boundAt: new Date().toISOString() },
  { id: randomUUID(), employeeName: "陳小華", lineUserId: null, boundAt: null },
  { id: randomUUID(), employeeName: "林小芳", lineUserId: null, boundAt: null },
];

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

export async function deleteEmployee(id: string): Promise<void> {
  const index = employees.findIndex((e) => e.id === id);
  if (index !== -1) {
    employees.splice(index, 1);
  }
}
