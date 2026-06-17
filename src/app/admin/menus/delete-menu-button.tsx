"use client";

import { useTransition } from "react";
import { deleteMenuAction } from "./actions";

export default function DeleteMenuButton({
  menuId,
  label,
}: {
  menuId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`確定要刪除「${label}」的菜單紀錄？此操作無法復原。`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", menuId);
      await deleteMenuAction(fd);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="text-sm text-red-600 underline disabled:opacity-50"
    >
      {pending ? "刪除中..." : "刪除"}
    </button>
  );
}
