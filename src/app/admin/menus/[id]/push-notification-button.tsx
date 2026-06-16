"use client";

import { useActionState } from "react";
import { pushMenuNotificationAction } from "../actions";

export default function PushNotificationButton({ menuId }: { menuId: string }) {
  const [state, formAction, pending] = useActionState(pushMenuNotificationAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="menuId" value={menuId} />
      <button
        id="push-notification-submit"
        type="submit"
        disabled={pending}
        className="bg-[#06C755] text-white rounded px-4 py-2 disabled:opacity-50 self-start"
      >
        {pending ? "推播中..." : "推播至 LINE 群組"}
      </button>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700">
          ✅ 已推播（同一天 {state.pushedCount} 張收單中的菜單合併成一則訊息）
        </p>
      )}
    </form>
  );
}
