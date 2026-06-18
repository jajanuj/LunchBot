"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createEmployee, createEmployeesBulk, deleteEmployee, deleteEmployeesBatch } from "@/lib/data/employees";

export type CreateEmployeeActionState = { error?: string } | undefined;

export async function createEmployeeAction(
  _prevState: CreateEmployeeActionState,
  formData: FormData
): Promise<CreateEmployeeActionState> {
  await verifySession(); // 安全檢查：未登入會被導回 /login

  const name = String(formData.get("employeeName") ?? "");
  const result = await createEmployee(name);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin/employees");
  return undefined;
}

export type BulkImportActionState =
  | { createdCount: number; skipped: { name: string; reason: string }[] }
  | undefined;

export async function bulkImportEmployeesAction(
  _prevState: BulkImportActionState,
  formData: FormData
): Promise<BulkImportActionState> {
  await verifySession();

  const namesText = String(formData.get("namesText") ?? "");
  const names = namesText
    .split(/\r?\n|,/) // 支援換行或逗號分隔（貼 Excel 欄位、.csv 都吃得下）
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const result = await createEmployeesBulk(names);

  revalidatePath("/admin/employees");
  return { createdCount: result.created.length, skipped: result.skipped };
}

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteEmployee(id);
  }

  revalidatePath("/admin/employees");
}

export async function batchDeleteEmployeesAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  await verifySession();

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "請至少選取一筆員工" };

  try {
    await deleteEmployeesBatch(ids);
  } catch (e) {
    return { error: (e as Error).message };
  }

  revalidatePath("/admin/employees");
  return undefined;
}
