"use client";

import { useActionState } from "react";
import { createEmployeeAction } from "./actions";

export default function AddEmployeeForm() {
  const [state, formAction, pending] = useActionState(createEmployeeAction, undefined);

  return (
    <form action={formAction} className="flex items-end gap-2 mb-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="employeeName" className="text-sm font-medium">
          新增員工姓名
        </label>
        <input
          id="employeeName"
          name="employeeName"
          type="text"
          required
          maxLength={20}
          className="border rounded px-3 py-2"
        />
      </div>
      <button
        id="add-employee-submit"
        type="submit"
        disabled={pending}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {pending ? "新增中..." : "新增"}
      </button>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
