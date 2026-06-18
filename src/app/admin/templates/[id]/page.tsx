export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplate } from "@/lib/data/storeTemplates";
import TemplateEditForm from "./template-edit-form";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getTemplate(id);

  if (!template) {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/templates" className="text-sm underline text-gray-600 dark:text-gray-300">
          ← 返回樣板列表
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-4">編輯樣板：{template.storeName}</h1>
      <TemplateEditForm template={template} />
    </div>
  );
}
