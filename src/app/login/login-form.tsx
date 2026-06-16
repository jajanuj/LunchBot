"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          帳號（Email）
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="border rounded px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          密碼
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="border rounded px-3 py-2"
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {pending ? "登入中..." : "登入"}
      </button>
    </form>
  );
}
