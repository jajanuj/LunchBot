"use client";

import { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import type { Employee } from "@/lib/data/employees";
import type { Menu } from "@/lib/data/menus";
import type { Order } from "@/lib/data/orders";
import {
  getEmployeeByLineUserIdAction,
  getUnboundEmployeesAction,
  bindEmployeeAction,
  getMenuForOrderingAction,
  getExistingOrderAction,
  submitOrderAction,
  cancelOrderAction,
} from "./actions";

// 是否允許「開發測試模式」身分模擬入口。Next.js 在 production build 時會把
// process.env.NODE_ENV 直接替換成字面值 "production"，這個分支在正式環境
// 會被打包工具判定為永遠不會執行而整段移除，不會出現在上線的 JS 裡。
const ALLOW_DEV_IDENTITY_OVERRIDE = process.env.NODE_ENV !== "production";

type Stage =
  | "initializing"
  | "need-line-app"
  | "dev-identity-prompt"
  | "select-name"
  | "ordering"
  | "error";

type ItemState = { quantity: number; notes: string };

export default function OrderApp({ menuId }: { menuId: string }) {
  const [stage, setStage] = useState<Stage>("initializing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const [unboundEmployees, setUnboundEmployees] = useState<Employee[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [existingOrder, setExistingOrder] = useState<Order | null>(null);
  const [itemsState, setItemsState] = useState<Record<string, ItemState>>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 1. 初始化 LIFF，解析目前使用者身分
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
      if (!liffId) {
        setErrorMessage("環境變數 NEXT_PUBLIC_LINE_LIFF_ID 未設定");
        setStage("error");
        return;
      }

      try {
        await liff.init({ liffId });
      } catch (err) {
        setErrorMessage(`LIFF 初始化失敗：${err instanceof Error ? err.message : String(err)}`);
        setStage("error");
        return;
      }

      if (cancelled) return;

      if (liff.isLoggedIn()) {
        try {
          const profile = await liff.getProfile();
          if (cancelled) return;
          setLineUserId(profile.userId);
          setDisplayName(profile.displayName);
          return;
        } catch (err) {
          setErrorMessage(`取得 LINE 個人資料失敗：${err instanceof Error ? err.message : String(err)}`);
          setStage("error");
          return;
        }
      }

      // 未登入：在 LINE App 內應該不會發生，但保險起見處理一下
      if (liff.isInClient()) {
        liff.login();
        return;
      }

      // 在一般瀏覽器（不在 LINE App 裡）又沒登入：
      // 開發測試環境提供身分模擬入口，正式環境只顯示提示訊息
      setStage(ALLOW_DEV_IDENTITY_OVERRIDE ? "dev-identity-prompt" : "need-line-app");
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. 有身分後，查這個 lineUserId 對應哪個員工
  useEffect(() => {
    if (!lineUserId) return;
    let cancelled = false;

    async function resolveEmployee() {
      const found = await getEmployeeByLineUserIdAction(lineUserId!);
      if (cancelled) return;
      if (found) {
        setEmployee(found);
      } else {
        const unbound = await getUnboundEmployeesAction();
        if (cancelled) return;
        setUnboundEmployees(unbound);
        setStage("select-name");
      }
    }

    resolveEmployee();
    return () => {
      cancelled = true;
    };
  }, [lineUserId]);

  // 3. 員工確定後，載入菜單與既有訂單
  useEffect(() => {
    if (!employee) return;
    let cancelled = false;

    async function loadMenuAndOrder() {
      const [loadedMenu, loadedOrder] = await Promise.all([
        getMenuForOrderingAction(menuId),
        getExistingOrderAction(menuId, employee!.id),
      ]);
      if (cancelled) return;

      if (!loadedMenu) {
        setErrorMessage("找不到這張菜單，連結可能已失效");
        setStage("error");
        return;
      }

      setMenu(loadedMenu);
      setExistingOrder(loadedOrder);

      const initialItemsState: Record<string, ItemState> = {};
      for (const item of loadedMenu.items) {
        const existingItem = loadedOrder?.items.find((i) => i.menuItemId === item.id);
        initialItemsState[item.id] = {
          quantity: existingItem?.quantity ?? 0,
          notes: existingItem?.customNotes ?? "",
        };
      }
      setItemsState(initialItemsState);
      setStage("ordering");
    }

    loadMenuAndOrder();
    return () => {
      cancelled = true;
    };
  }, [employee, menuId]);

  const totalAmount = useMemo(() => {
    if (!menu) return 0;
    return menu.items.reduce((sum, item) => {
      const qty = itemsState[item.id]?.quantity ?? 0;
      return sum + qty * item.price;
    }, 0);
  }, [menu, itemsState]);

  async function handleBindEmployee(employeeId: string) {
    if (!lineUserId) return;
    setPending(true);
    const result = await bindEmployeeAction(employeeId, lineUserId);
    setPending(false);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    setEmployee(result.employee);
  }

  async function handleSubmitOrder() {
    if (!employee) return;
    const items = Object.entries(itemsState)
      .filter(([, state]) => state.quantity > 0)
      .map(([menuItemId, state]) => ({
        menuItemId,
        quantity: state.quantity,
        customNotes: state.notes,
      }));

    setPending(true);
    setSubmitMessage(null);
    const result = await submitOrderAction(menuId, employee.id, items);
    setPending(false);

    if (!result.ok) {
      setSubmitMessage(`❌ ${result.error}`);
      return;
    }
    setExistingOrder(result.order);
    setSubmitMessage("✅ 訂單已送出");
  }

  async function handleCancelOrder() {
    if (!employee) return;
    setPending(true);
    await cancelOrderAction(menuId, employee.id);
    setPending(false);
    setExistingOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
    setSubmitMessage("已取消訂單");
  }

  if (stage === "initializing") {
    return <CenteredMessage>載入中...</CenteredMessage>;
  }

  if (stage === "error") {
    return <CenteredMessage>⚠️ {errorMessage}</CenteredMessage>;
  }

  if (stage === "need-line-app") {
    return <CenteredMessage>請在 LINE App 中開啟此頁面（點擊群組通知裡的「我要點餐」按鈕）。</CenteredMessage>;
  }

  if (stage === "dev-identity-prompt") {
    return (
      <DevIdentityPrompt
        onSubmit={(userId, name) => {
          setLineUserId(userId);
          setDisplayName(name);
        }}
      />
    );
  }

  if (stage === "select-name") {
    return (
      <main className="min-h-screen flex flex-col items-center gap-4 p-6">
        <h1 className="text-lg font-bold">請選擇您的姓名完成綁定</h1>
        <p className="text-sm text-gray-600">
          您好 {displayName ?? ""}，第一次使用請從下方名單選擇本人姓名（僅顯示尚未綁定的員工）。
        </p>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <ul id="unbound-employee-list" className="flex flex-col gap-2 w-full max-w-sm">
          {unboundEmployees.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleBindEmployee(e.id)}
                className="w-full border rounded px-4 py-2 text-left disabled:opacity-50"
                data-employee-name={e.employeeName}
              >
                {e.employeeName}
              </button>
            </li>
          ))}
          {unboundEmployees.length === 0 && (
            <li className="text-sm text-gray-500">目前沒有尚未綁定的員工，請聯絡助理協助處理。</li>
          )}
        </ul>
      </main>
    );
  }

  // stage === "ordering"
  if (!menu) return <CenteredMessage>載入菜單中...</CenteredMessage>;

  const isCancelled = existingOrder?.status === "cancelled";
  const canOrder = menu.status === "open";

  return (
    <main className="min-h-screen flex flex-col gap-4 p-6 max-w-md mx-auto">
      <h1 className="text-lg font-bold">
        {menu.sessionName ?? "點餐"}｜{menu.storeName}
      </h1>
      <p className="text-sm text-gray-600">
        {canOrder ? "收單中" : "已截止收單"}
        {existingOrder && existingOrder.status === "pending" && "　|　您已送出訂單，可修改"}
        {isCancelled && "　|　您已取消這張訂單"}
      </p>

      <div className="flex flex-col gap-3">
        {menu.items.map((item) => (
          <div key={item.id} className="border rounded p-3 flex flex-col gap-2">
            <div className="flex justify-between">
              <span>{item.itemName}</span>
              <span>${item.price}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600" htmlFor={`qty-${item.id}`}>
                數量
              </label>
              <input
                id={`qty-${item.id}`}
                type="number"
                min={0}
                disabled={!canOrder}
                value={itemsState[item.id]?.quantity ?? 0}
                onChange={(e) =>
                  setItemsState((prev) => ({
                    ...prev,
                    [item.id]: { ...prev[item.id], quantity: Number(e.target.value) },
                  }))
                }
                className="border rounded px-2 py-1 w-20"
              />
            </div>
            <input
              type="text"
              placeholder="備註（如：微糖微冰）"
              disabled={!canOrder}
              value={itemsState[item.id]?.notes ?? ""}
              onChange={(e) =>
                setItemsState((prev) => ({
                  ...prev,
                  [item.id]: { ...prev[item.id], notes: e.target.value },
                }))
              }
              className="border rounded px-2 py-1"
            />
          </div>
        ))}
      </div>

      <p className="font-bold">總金額：${totalAmount}</p>

      {submitMessage && <p>{submitMessage}</p>}

      {canOrder && (
        <div className="flex gap-3">
          <button
            id="submit-order-button"
            type="button"
            disabled={pending}
            onClick={handleSubmitOrder}
            className="bg-[#06C755] text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {pending ? "送出中..." : existingOrder?.status === "pending" ? "更新訂單" : "送出訂單"}
          </button>
          {existingOrder?.status === "pending" && (
            <button
              id="cancel-order-button"
              type="button"
              disabled={pending}
              onClick={handleCancelOrder}
              className="text-sm text-red-600 underline disabled:opacity-50"
            >
              取消訂單
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <p>{children}</p>
    </main>
  );
}

function DevIdentityPrompt({
  onSubmit,
}: {
  onSubmit: (userId: string, displayName: string) => void;
}) {
  const [userId, setUserId] = useState("");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm bg-yellow-100 border border-yellow-400 rounded px-3 py-2">
        ⚠️ 開發測試模式：正式環境不會出現這個畫面，請改在 LINE App 中開啟。
      </p>
      <h1 className="text-lg font-bold">模擬 LINE 身分登入</h1>
      <input
        id="dev-line-user-id"
        type="text"
        placeholder="輸入任意 line_user_id（如 U_demo_1）"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="border rounded px-3 py-2 w-72"
      />
      <button
        id="dev-identity-submit"
        type="button"
        disabled={!userId.trim()}
        onClick={() => onSubmit(userId.trim(), "開發測試使用者")}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        模擬登入
      </button>
    </main>
  );
}
