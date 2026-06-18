"use server";

import { generatePayrollDeductions, markPayrollExported } from "@/lib/data/payrollDeductions";

export async function generatePayrollAction(formData: FormData): Promise<{ inserted?: number; error?: string }> {
  const billingPeriod = (formData.get("billingPeriod") as string | null)?.trim();
  if (!billingPeriod || !/^\d{4}-\d{2}$/.test(billingPeriod)) {
    return { error: "請輸入正確帳期格式（YYYY-MM）" };
  }
  try {
    const inserted = await generatePayrollDeductions(billingPeriod);
    return { inserted };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function markExportedAction(formData: FormData): Promise<{ updated?: number; error?: string }> {
  const billingPeriod = (formData.get("billingPeriod") as string | null)?.trim();
  if (!billingPeriod || !/^\d{4}-\d{2}$/.test(billingPeriod)) {
    return { error: "請輸入正確帳期格式（YYYY-MM）" };
  }
  try {
    const updated = await markPayrollExported(billingPeriod);
    return { updated };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
