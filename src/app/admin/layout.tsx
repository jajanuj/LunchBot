import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { logout } from "@/lib/auth/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 防線之二：proxy 只做樂觀檢查，這裡才是真正的授權檢查（見 dal.ts 註解）
  const user = await verifySession();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-bold">訂餐暨飲料系統 - 後台</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="underline">
            首頁
          </Link>
          <Link href="/admin/employees" className="underline">
            員工名冊
          </Link>
          <Link href="/admin/menus" className="underline">
            菜單管理
          </Link>
          <Link href="/admin/templates" className="underline">
            歷史樣板
          </Link>
          <Link href="/admin/payroll" className="underline">
            薪資扣款
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-300">{user.displayName}</span>
          <form action={logout}>
            <button id="logout-submit" type="submit" className="text-sm underline">
              登出
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
