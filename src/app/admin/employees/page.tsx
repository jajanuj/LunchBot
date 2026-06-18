import { listEmployees } from "@/lib/data/employees";
import AddEmployeeForm from "./add-employee-form";
import BulkImportForm from "./bulk-import-form";
import EmployeeListTable from "./employee-list-table";

export default async function EmployeesPage() {
  const employees = await listEmployees();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">員工名冊</h1>

      <AddEmployeeForm />
      <BulkImportForm />

      <details className="mb-6 border rounded p-4">
        <summary className="cursor-pointer font-medium">LINE 綁定說明</summary>
        <div className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          <p className="font-medium mb-2">員工如何綁定 LINE 帳號：</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>先在上方新增員工姓名到名冊</li>
            <li>前往菜單管理，建立今日菜單並推播通知給全體員工</li>
            <li>員工收到 LINE 通知後，點擊「我要點餐」進入點餐頁面</li>
            <li>首次進入時，頁面會列出名冊，員工點選自己的名字完成綁定</li>
            <li>往後點餐系統自動識別，不需再選取</li>
          </ol>
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            ⚠️ 若狀態顯示「未綁定」，表示該員工尚未使用 LINE 點過餐，請請他們點擊最近一次的點餐通知完成綁定。
          </p>
        </div>
      </details>

      <EmployeeListTable employees={employees} />
    </div>
  );
}
