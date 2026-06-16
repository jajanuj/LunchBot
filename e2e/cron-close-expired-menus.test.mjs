// E2E 測試：截止時間自動關閉菜單的排程端點
// 用法：npm run test:e2e:cron-close-menus
//
// 這個端點是排程觸發（Vercel Cron），不是給人點的頁面：用 Puppeteer 建立
// 一張「截止時間在過去」的測試菜單，再用真實 HTTP request 呼叫排程端點，
// 確認該菜單被自動關閉、且未過期的菜單不會被誤關。
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3114;
const BASE_URL = `http://localhost:${PORT}`;
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error(
    "[e2e:cron-close-menus] ❌ 找不到環境變數 CRON_SECRET。\n" +
      "請用「node --env-file=.env.local e2e/cron-close-expired-menus.test.mjs」執行（npm script 已內建這個 flag）。"
  );
  process.exit(1);
}

// datetime-local 欄位存的是「沒有時區資訊」的字串，伺服器解析時會用自己的
// 本地時區當作基準。這裡刻意用本地時間的年月日時分組字串（而不是
// toISOString()，那會是 UTC，在時區不是 UTC 的機器上會差好幾個小時），
// 確保跟伺服器解析邏輯一致。
function toLocalDatetimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function setInputValue(page, selector, value) {
  return page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel);
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    selector,
    value
  );
}

async function createMenu(page, { storeName, cutoffTime }) {
  const menuDate = toLocalDatetimeInputValue(new Date()).slice(0, 10);
  await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
  await setInputValue(page, "#menuDate", menuDate);
  await page.type("#storeName", storeName);
  await setInputValue(page, "#cutoffTime", cutoffTime);
  const nameInput = await page.$('input[name="itemName"]');
  const priceInput = await page.$('input[name="itemPrice"]');
  await nameInput.type("測試品項");
  await priceInput.type("50");
  await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);

  const linkHandle = await page.evaluateHandle((name) => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    const row = rows.find((r) => r.textContent.includes(name));
    return row ? row.querySelector("a") : null;
  }, storeName);
  await Promise.all([linkHandle.asElement().click(), page.waitForNetworkIdle()]);
  return page.url().split("/").pop();
}

async function main() {
  console.log(`[e2e:cron-close-menus] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:cron-close-menus] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      const pastTime = toLocalDatetimeInputValue(new Date(Date.now() - 60 * 60 * 1000)); // 1 小時前
      const futureTime = toLocalDatetimeInputValue(new Date(Date.now() + 60 * 60 * 1000)); // 1 小時後

      const expiredStoreName = `已過期店家_${Date.now()}`;
      const activeStoreName = `未過期店家_${Date.now()}`;
      const expiredMenuId = await createMenu(page, { storeName: expiredStoreName, cutoffTime: pastTime });
      const activeMenuId = await createMenu(page, { storeName: activeStoreName, cutoffTime: futureTime });

      // 1. 沒帶正確密鑰 -> 401
      const unauthorizedRes = await fetch(`${BASE_URL}/api/cron/close-expired-menus`, {
        headers: { Authorization: "Bearer wrong-secret" },
      });
      assert(unauthorizedRes.status === 401, `錯誤密鑰應回 401，實際：${unauthorizedRes.status}`);
      console.log("[e2e:cron-close-menus] ✅ 錯誤密鑰正確被拒絕");

      // 2. 正確密鑰 -> 過期菜單被關閉，未過期菜單不受影響
      const res = await fetch(`${BASE_URL}/api/cron/close-expired-menus`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      assert(res.status === 200, `正確密鑰應回 200，實際：${res.status}`);
      const body = await res.json();
      assert(body.closedCount >= 1, `應至少關閉 1 張過期菜單，實際 closedCount：${body.closedCount}`);
      console.log("[e2e:cron-close-menus] ✅ 排程端點成功執行並回報關閉數量");

      await page.goto(`${BASE_URL}/admin/menus/${expiredMenuId}`, { waitUntil: "networkidle0" });
      let bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("已結單"), `過期菜單應顯示已結單，實際：${bodyText}`);
      console.log("[e2e:cron-close-menus] ✅ 過期菜單狀態正確變更為已結單");

      await page.goto(`${BASE_URL}/admin/menus/${activeMenuId}`, { waitUntil: "networkidle0" });
      bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("收單中"), `未過期菜單應仍是收單中，實際：${bodyText}`);
      console.log("[e2e:cron-close-menus] ✅ 未過期菜單不受影響，仍為收單中");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:cron-close-menus] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
