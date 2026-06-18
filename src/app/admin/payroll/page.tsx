import { listPayrollDeductions, summarizeByEmployee } from "@/lib/data/payrollDeductions";
import PayrollClient from "./payroll-client";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const period = rawPeriod && /^\d{4}-\d{2}$/.test(rawPeriod) ? rawPeriod : defaultPeriod;

  const deductions = await listPayrollDeductions(period);
  const summary = summarizeByEmployee(deductions);

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">月結薪資扣款</h1>
      <PayrollClient
        initialPeriod={period}
        initialSummary={summary}
        initialDeductions={deductions}
      />
    </div>
  );
}
