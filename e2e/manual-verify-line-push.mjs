// 手動驗證腳本：實際建立一張菜單並推播到真實 LINE 群組。
// 用法：node --env-file=.env.local e2e/manual-verify-line-push.mjs
//
// ⚠️ 這個腳本會真的呼叫 LINE API、在 LINE_GROUP_ID 對應的群組裡發一則訊息。
// 故意不放進 npm run test:e2e（不適合每次跑測試就洗一次群組版面/消耗額度），
// 只在「需要人工確認推播功能仍正常」時手動執行一次。
//
// 注意：同一個專案資料夾只能跑一個 next dev（即使 port 不同也會互相打架，
// 用 .next build 目錄當鎖），所以這個腳本會先檢查 3000 port 有沒有人在用：
// 有的話直接借用（例如你開著 ngrok 測試用的那個），沒有的話才自己啟動一個。
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

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

async function isServerAlreadyRunning() {
  try {
    const res = await fetch(BASE_URL, { method: "GET" });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  const reuseExisting = await isServerAlreadyRunning();
  let server = null;

  if (reuseExisting) {
    console.log(`[manual-verify] port ${PORT} 已經有伺服器在跑，直接借用（不會自己啟動新的）...`);
  } else {
    console.log(`[manual-verify] 啟動 Next.js dev server（port ${PORT}）...`);
    server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });
    await waitForServerReady(server);
  }

  let exitCode = 0;
  try {
    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      const menuDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", menuDate);
      await page.type("#sessionName", "人工驗證推播");
      await page.type("#storeName", `驗證用測試店家_${Date.now()}`);
      await setInputValue(page, "#cutoffTime", `${menuDate}T23:00`);
      const nameInput = await page.$('input[name="itemName"]');
      const priceInput = await page.$('input[name="itemPrice"]');
      await nameInput.type("測試品項");
      await priceInput.type("100");

      await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);

      const detailLinkHandle = await page.evaluateHandle(() => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        return rows[0] ? rows[0].querySelector("a") : null;
      });
      await Promise.all([detailLinkHandle.asElement().click(), page.waitForNetworkIdle()]);

      console.log("[manual-verify] 點擊「推播至 LINE 群組」...");
      await Promise.all([
        page.click("#push-notification-submit"),
        page.waitForNetworkIdle(),
      ]);

      const bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("已推播"), `應顯示推播成功訊息，實際畫面：\n${bodyText}`);
      console.log("[manual-verify] ✅ UI 顯示推播成功，請去 LINE 確認群組是否收到 Carousel 卡片訊息。");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[manual-verify] ❌ 失敗：", err.message);
    exitCode = 1;
  } finally {
    if (server) killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
