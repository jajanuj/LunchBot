import OrderApp from "./order-app";

export default async function LiffOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ menuId?: string }>;
}) {
  const { menuId } = await searchParams;

  if (!menuId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-600">缺少 menuId 參數，請從 LINE 推播訊息的按鈕進入此頁面。</p>
      </main>
    );
  }

  return <OrderApp menuId={menuId} />;
}
