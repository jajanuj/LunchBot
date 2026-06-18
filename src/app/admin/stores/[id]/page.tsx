export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplate } from "@/lib/data/storeTemplates";
import StoreEditForm from "./store-edit-form";

export default async function StoreEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getTemplate(id);

  if (!store) {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/stores" className="text-sm underline text-gray-600 dark:text-gray-300">
          ← 返回店家管理
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-4">編輯店家：{store.storeName}</h1>
      <StoreEditForm store={store} />
    </div>
  );
}
