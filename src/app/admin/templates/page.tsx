import Link from "next/link";
import { listTemplates } from "@/lib/data/storeTemplates";
import { deleteTemplateAction } from "./actions";

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">歷史店家樣板</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        新增菜單時可套用這裡的樣板自動帶入品項。點擊「編輯」可修改店家名稱與品項。
      </p>

      {templates.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          目前沒有任何歷史樣板。新增菜單並勾選「存為樣板」後，店家資料會自動出現在這裡。
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4">店家名稱</th>
              <th className="py-2 pr-4">品項數</th>
              <th className="py-2 pr-4">最近使用</th>
              <th className="py-2 pr-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tmpl) => (
              <tr key={tmpl.id} className="border-b">
                <td className="py-2 pr-4">{tmpl.storeName}</td>
                <td className="py-2 pr-4">{tmpl.items.length}</td>
                <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                  {tmpl.lastUsedAt
                    ? new Date(tmpl.lastUsedAt).toLocaleDateString("zh-TW")
                    : "-"}
                </td>
                <td className="py-2 pr-4 flex gap-3">
                  <Link
                    href={`/admin/templates/${tmpl.id}`}
                    className="text-sm underline"
                  >
                    編輯
                  </Link>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="id" value={tmpl.id} />
                    <button
                      id={`delete-template-${tmpl.id}`}
                      type="submit"
                      className="text-sm text-red-600 underline"
                    >
                      刪除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
