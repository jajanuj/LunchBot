import { listEmployees } from "@/lib/data/employees";
import { deleteEmployeeAction } from "./actions";
import AddEmployeeForm from "./add-employee-form";

export default async function EmployeesPage() {
  const employees = await listEmployees();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">員工名冊</h1>

      <AddEmployeeForm />

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
                  <span className="text-gray-500">未綁定</span>
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
              <td colSpan={3} className="py-4 text-gray-500">
                目前沒有任何員工，請先新增。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
