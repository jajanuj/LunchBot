"use client";

import { useEffect, useMemo, useState } from "react";
import liff from "@line/liff";
import type { Employee } from "@/lib/data/employees";
import type { Menu, MenuItemRecord } from "@/lib/data/menus";
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

const ALLOW_DEV_IDENTITY_OVERRIDE = process.env.NODE_ENV !== "production";

const ICE_LEVELS = ["熱", "正常冰", "少冰", "微冰", "去冰"] as const;
const SUGAR_LEVELS = ["全糖", "少糖", "半糖", "微糖", "無糖"] as const;

type Stage =
  | "initializing"
  | "dev-identity-prompt"
  | "select-name"
  | "ordering"
  | "error";

type ItemState = {
  quantity: number;
  notes: string;
  iceLevel: string;
  sugarLevel: string;
};

// 從已儲存的 customNotes 字串反解出冰量/糖量/其他備註
function parseStoredNotes(
  customNotes: string,
  isDrink: boolean
): { iceLevel: string; sugarLevel: string; notes: string } {
  if (!isDrink || !customNotes) {
    return { iceLevel: "", sugarLevel: "", notes: customNotes };
  }
  const parts = customNotes.split(" / ");
  let iceLevel = "";
  let sugarLevel = "";
  const remaining: string[] = [];
  for (const p of parts) {
    if ((ICE_LEVELS as readonly string[]).includes(p)) iceLevel = p;
    else if ((SUGAR_LEVELS as readonly string[]).includes(p)) sugarLevel = p;
    else remaining.push(p);
  }
  return { iceLevel, sugarLevel, notes: remaining.join(" / ") };
}

// 把冰量/糖量/備註合併成 customNotes 字串存入訂單
function buildCustomNotes(state: ItemState, isDrink: boolean): string {
  if (!isDrink) return state.notes;
  const parts: string[] = [];
  if (state.iceLevel) parts.push(state.iceLevel);
  if (state.sugarLevel) parts.push(state.sugarLevel);
  if (state.notes.trim()) parts.push(state.notes.trim());
  return parts.join(" / ");
}

// menuId 不接受 prop，改在 liff.init() 完成後從 window.location.search 讀取。
// 原因：LINE LIFF 透過 liff.state 傳遞的 query params 是在 init() 之後
// 才更新至 window.location，server 端 searchParams 在這之前看不到 menuId。
export default function OrderApp() {
  const [menuId, setMenuId] = useState<string | null>(null);
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

  // 1. 初始化 LIFF
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

      const extractedMenuId = new URLSearchParams(window.location.search).get("menuId");
      if (!extractedMenuId) {
        setErrorMessage("缺少 menuId 參數，請從 LINE 推播訊息的按鈕進入此頁面。");
        setStage("error");
        return;
      }
      setMenuId(extractedMenuId);

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

      // 未登入：開發模式顯示身分模擬入口，正式環境呼叫 liff.login()。
      // liff.login() 在 LINE App 內開啟原生授權，在一般瀏覽器（含電腦版 LINE 跳出的視窗）
      // 則跳轉至 LINE OAuth 網頁，登入後自動回到點餐頁，menuId 參數由 LIFF SDK 保留。
      if (ALLOW_DEV_IDENTITY_OVERRIDE) {
        setStage("dev-identity-prompt");
        return;
      }

      liff.login();
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // 2. 有身分後，查對應員工
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
    return () => { cancelled = true; };
  }, [lineUserId]);

  // 3. 員工確定後，載入菜單與既有訂單
  useEffect(() => {
    if (!employee || !menuId) return;
    let cancelled = false;

    async function loadMenuAndOrder() {
      const [loadedMenu, loadedOrder] = await Promise.all([
        getMenuForOrderingAction(menuId!),
        getExistingOrderAction(menuId!, employee!.id),
      ]);
      if (cancelled) return;

      if (!loadedMenu) {
        setErrorMessage("找不到這張菜單，連結可能已失效");
        setStage("error");
        return;
      }

      setMenu(loadedMenu);
      setExistingOrder(loadedOrder);

      const initial: Record<string, ItemState> = {};
      for (const item of loadedMenu.items) {
        const existingItem = loadedOrder?.items.find((i) => i.menuItemId === item.id);
        const isDrink = item.category === "drink";
        const { iceLevel, sugarLevel, notes } = parseStoredNotes(
          existingItem?.customNotes ?? "",
          isDrink
        );
        initial[item.id] = {
          quantity: existingItem?.quantity ?? 0,
          notes,
          iceLevel,
          sugarLevel,
        };
      }
      setItemsState(initial);
      setStage("ordering");
    }

    loadMenuAndOrder();
    return () => { cancelled = true; };
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
    if (!employee || !menuId || !menu) return;
    const items = Object.entries(itemsState)
      .filter(([, state]) => state.quantity > 0)
      .map(([menuItemId, state]) => {
        const menuItem = menu.items.find((i) => i.id === menuItemId);
        const isDrink = menuItem?.category === "drink";
        return {
          menuItemId,
          quantity: state.quantity,
          customNotes: buildCustomNotes(state, isDrink),
        };
      });

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
    if (!employee || !menuId) return;
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
            <li className="text-sm text-gray-500">
              目前沒有尚未綁定的員工，請聯絡助理協助處理。
            </li>
          )}
        </ul>
      </main>
    );
  }

  // stage === "ordering"
  if (!menu) return <CenteredMessage>載入菜單中...</CenteredMessage>;

  const canOrder = menu.status === "open";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 固定頂部：菜單名稱 + 總金額 + 操作按鈕 */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">
              {menu.sessionName ?? "點餐"}｜{menu.storeName}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {canOrder ? "收單中" : "已截止收單"}
              {existingOrder?.status === "pending" && "　｜　已送出，可修改"}
              {existingOrder?.status === "cancelled" && "　｜　已取消"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold">${totalAmount}</span>
            {canOrder && existingOrder?.status === "pending" && (
              <button
                id="cancel-order-button"
                type="button"
                disabled={pending}
                onClick={handleCancelOrder}
                className="text-sm text-red-500 underline disabled:opacity-50"
              >
                取消
              </button>
            )}
            {canOrder && (
              <button
                id="submit-order-button"
                type="button"
                disabled={pending}
                onClick={handleSubmitOrder}
                className="bg-[#06C755] text-white rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {pending
                  ? "..."
                  : existingOrder?.status === "pending"
                  ? "更新"
                  : "送出"}
              </button>
            )}
          </div>
        </div>
        {submitMessage && (
          <p className="text-xs mt-1 text-center text-gray-600 dark:text-gray-300">
            {submitMessage}
          </p>
        )}
      </div>

      {/* 品項兩欄排列 */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {menu.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            state={
              itemsState[item.id] ?? {
                quantity: 0,
                notes: "",
                iceLevel: "",
                sugarLevel: "",
              }
            }
            onChange={(s) =>
              setItemsState((prev) => ({ ...prev, [item.id]: s }))
            }
            canOrder={canOrder}
          />
        ))}
      </div>
    </div>
  );
}

// ── 品項卡片 ──────────────────────────────────────────────

function ItemCard({
  item,
  state,
  onChange,
  canOrder,
}: {
  item: MenuItemRecord;
  state: ItemState;
  onChange: (s: ItemState) => void;
  canOrder: boolean;
}) {
  const isDrink = item.category === "drink";

  return (
    <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-3 flex flex-col gap-2">
      {/* 品名與價格 */}
      <div className="flex justify-between items-start gap-1">
        <span className="font-medium text-sm leading-snug">{item.itemName}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 mt-0.5">
          ${item.price}
        </span>
      </div>

      {/* 數量 stepper */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-qty-minus={item.id}
          disabled={!canOrder || state.quantity === 0}
          onClick={() => onChange({ ...state, quantity: Math.max(0, state.quantity - 1) })}
          className="w-8 h-8 border dark:border-gray-600 rounded-lg text-lg leading-none flex items-center justify-center disabled:opacity-30 shrink-0 active:bg-gray-100 dark:active:bg-gray-700"
        >
          −
        </button>
        <span
          data-qty-display={item.id}
          className="text-sm font-medium w-6 text-center tabular-nums"
        >
          {state.quantity}
        </span>
        <button
          type="button"
          data-qty-plus={item.id}
          disabled={!canOrder}
          onClick={() => onChange({ ...state, quantity: state.quantity + 1 })}
          className="w-8 h-8 border dark:border-gray-600 rounded-lg text-lg leading-none flex items-center justify-center disabled:opacity-30 shrink-0 active:bg-gray-100 dark:active:bg-gray-700"
        >
          +
        </button>
      </div>

      {/* 飲料專屬：冰量 + 糖量 */}
      {isDrink && (
        <>
          <div>
            <p className="text-xs text-gray-400 mb-1">冰量</p>
            <div className="flex flex-wrap gap-1">
              {ICE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={!canOrder}
                  onClick={() =>
                    onChange({
                      ...state,
                      iceLevel: state.iceLevel === level ? "" : level,
                    })
                  }
                  className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                    state.iceLevel === level
                      ? "bg-sky-500 text-white border-sky-500"
                      : "border-gray-300 dark:border-gray-600 dark:text-gray-300"
                  } disabled:opacity-40`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">糖量</p>
            <div className="flex flex-wrap gap-1">
              {SUGAR_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={!canOrder}
                  onClick={() =>
                    onChange({
                      ...state,
                      sugarLevel: state.sugarLevel === level ? "" : level,
                    })
                  }
                  className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                    state.sugarLevel === level
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "border-gray-300 dark:border-gray-600 dark:text-gray-300"
                  } disabled:opacity-40`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 備註（食物 + 飲料都有） */}
      <input
        type="text"
        placeholder="備註"
        disabled={!canOrder}
        value={state.notes}
        onChange={(e) => onChange({ ...state, notes: e.target.value })}
        className="border dark:border-gray-600 rounded-lg px-2 py-1 text-xs w-full disabled:opacity-50 bg-transparent dark:placeholder-gray-500"
      />
    </div>
  );
}

// ── 通用 helper components ─────────────────────────────────

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <p className="text-gray-600 dark:text-gray-300">{children}</p>
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
