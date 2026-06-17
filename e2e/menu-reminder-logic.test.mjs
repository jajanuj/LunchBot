// 測試：截止前提醒推播的判斷邏輯（findMenusDueForReminder / markReminderSent）
// 用法：npm run test:e2e:menu-reminder-logic
//
// 這是純資料邏輯測試，不需要啟動 dev server、不會打網路（直接 import
// src/lib/data/menus.ts 裡的函式呼叫），跟 e2e/line-flex-message.test.mjs
// 是同一種做法。真的「送出提醒到 LINE 群組」那一段已經在
// src/app/api/cron/menu-maintenance/route.ts 裡用同一套邏輯接上
// getLineMessagingClient()，本檔案只驗證「哪些菜單該被提醒」判斷對不對。
import { assert } from "./utils.mjs";
import { createMenu, deleteMenu, findMenusDueForReminder, markReminderSent } from "../src/lib/data/menus.ts";

function isoOffsetMinutes(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function main() {
  const now = new Date();

  const today = new Date().toISOString().slice(0, 10);

  // 1. 截止前 5 分鐘、設定提醒 10 分鐘前 -> 提醒時間點已過 -> 應該到期
  const due = await createMenu({
    menuDate: today,
    sessionName: "到期提醒測試",
    storeName: `due_${Date.now()}`,
    cutoffTime: isoOffsetMinutes(5),
    reminderMinutesBefore: 10,
    items: [{ itemName: "x", price: 10 }],
  });
  assert(due.ok, "建立測試菜單應成功");

  // 2. 截止前 60 分鐘、設定提醒 10 分鐘前 -> 還沒到提醒時間 -> 不應該到期
  const notDue = await createMenu({
    menuDate: today,
    sessionName: "未到期提醒測試",
    storeName: `notdue_${Date.now()}`,
    cutoffTime: isoOffsetMinutes(60),
    reminderMinutesBefore: 10,
    items: [{ itemName: "x", price: 10 }],
  });
  assert(notDue.ok, "建立測試菜單應成功");

  // 3. 截止前 5 分鐘、沒設定提醒 -> 不應該出現在到期清單
  const noReminder = await createMenu({
    menuDate: today,
    sessionName: "沒設定提醒測試",
    storeName: `noreminder_${Date.now()}`,
    cutoffTime: isoOffsetMinutes(5),
    reminderMinutesBefore: null,
    items: [{ itemName: "x", price: 10 }],
  });
  assert(noReminder.ok, "建立測試菜單應成功");

  try {
    let dueList = await findMenusDueForReminder(now);
    let dueIds = dueList.map((m) => m.id);

    assert(dueIds.includes(due.menu.id), "已到提醒時間的菜單應出現在到期清單");
    assert(!dueIds.includes(notDue.menu.id), "還沒到提醒時間的菜單不應出現在到期清單");
    assert(!dueIds.includes(noReminder.menu.id), "沒設定提醒的菜單不應出現在到期清單");
    console.log("[menu-reminder-logic] ✅ 到期判斷邏輯正確（到期/未到期/沒設定提醒）");

    // 4. 標記已發送後，同一張菜單不應該再出現在到期清單（避免重複發送）
    await markReminderSent(due.menu.id, now);
    dueList = await findMenusDueForReminder(now);
    dueIds = dueList.map((m) => m.id);
    assert(!dueIds.includes(due.menu.id), "已標記發送過的菜單不應再出現在到期清單");
    console.log("[menu-reminder-logic] ✅ 標記已發送後不會重複出現在到期清單");
  } finally {
    // 清除測試資料，避免殘留 menu 在下次跑全套測試時干擾 cron-menu-maintenance
    await Promise.all([
      deleteMenu(due.menu.id),
      deleteMenu(notDue.menu.id),
      deleteMenu(noReminder.menu.id),
    ]);
  }
}

main()
  .then(() => console.log("[menu-reminder-logic] 全部通過"))
  .catch((err) => {
    console.error("[menu-reminder-logic] ❌ 測試失敗：", err.message);
    process.exit(1);
  });
