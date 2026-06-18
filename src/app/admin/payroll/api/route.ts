import { NextRequest, NextResponse } from "next/server";
import { listPayrollDeductions, summarizeByEmployee } from "@/lib/data/payrollDeductions";

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "";
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "invalid period" }, { status: 400 });
  }
  const deductions = await listPayrollDeductions(period);
  const summary = summarizeByEmployee(deductions);
  return NextResponse.json({ summary, deductions });
}
