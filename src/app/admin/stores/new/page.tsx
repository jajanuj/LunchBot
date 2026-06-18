export const dynamic = "force-dynamic";

import Link from "next/link";
import StoreNewForm from "./store-form";

export default function StoreNewPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/stores" className="text-sm underline text-gray-600 dark:text-gray-300">
          ← 返回店家管理
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-4">新增店家</h1>
      <StoreNewForm />
    </div>
  );
}
