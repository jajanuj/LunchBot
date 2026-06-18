import { listEmployees } from "@/lib/data/employees";
import { deleteEmployeeAction } from "./actions";
import AddEmployeeForm from "./add-employee-form";
import BulkImportForm from "./bulk-import-form";

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

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">姓名</th>
            <th className="py-2 pr-4">LINE 綁定狀態</th>
            <th className="py-2 pr-4">操作</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b">
              <td className="py-2 pr-4">{employee.employeeName}</td>
              <td className="py-2 pr-4">
                {employee.boundAt ? (
                  <span className="text-green-700">已綁定</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">未綁定</span>
                )}
              </td>
              <td className="py-2 pr-4">
                <form action={deleteEmployeeAction}>
                  <input type="hidden" name="id" value={employee.id} />
                  <button type="submit" className="text-sm text-red-600 underline">
                    刪除
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-gray-500 dark:text-gray-400">
                目前沒有任何員工，請先新增。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
