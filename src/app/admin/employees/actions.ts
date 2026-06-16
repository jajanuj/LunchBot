"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { createEmployee, deleteEmployee } from "@/lib/data/employees";

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

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteEmployee(id);
  }

  revalidatePath("/admin/employees");
}
