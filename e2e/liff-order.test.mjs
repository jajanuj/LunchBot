// E2E 測試：LIFF 點餐頁面（身分綁定 + 點餐 + 修改/取消 + 截止後鎖定）
// 用法：npm run test:e2e:liff-order
//
// LIFF 頁面在真實環境需要在 LINE App 裡開啟才能用 liff.getProfile() 拿到
// 真實身分，這部分需要真實 LINE 帳號，不適合自動化（也不應該用真帳號跑
// 測試腳本）。所以這裡走的是專案內建的「開發測試模式」身分模擬入口
// （只在 NODE_ENV !== 'production' 出現，正式 build 會被打包工具整段移除）。
//
// 涵蓋情境：
//   1. 模擬全新 LINE 身分 -> 顯示尚未綁定員工名單（已綁定的「王小明」不會出現）
//   2. 選擇姓名綁定 -> 進入點餐頁面
//   3. 送出訂單 -> 顯示成功訊息
//   4. 重新整理頁面、用同一個身分登入 -> 直接進點餐頁面且訂單內容已預填
//   5. 取消訂單 -> 重新點餐 -> 訂單復活成 pending
//   6. 助理把菜單結單後 -> LIFF 頁面顯示已截止、輸入框停用
//
// 備註：助理端的操作刻意用「全新的 page 物件」執行（建立菜單時用一個，
// 結單時再開一個新的），不要讓同一個 page 在另一個 page 跑很多步驟期間
// 閒置太久——實測發現閒置很久的 page 之後 click() 偶爾會卡死
// （Runtime.callFunctionOn timed out），換一個新 page 就穩定了。
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3112;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_LINE_USER_ID = `Utest_e2e_${Date.now()}`;

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

async function clickEmployeeButton(page, name) {
  const handle = await page.evaluateHandle((targetName) => {
    const buttons = Array.from(document.querySelectorAll("#unbound-employee-list button"));
    return buttons.find((b) => b.textContent.trim() === targetName) ?? null;
  }, name);
  const el = handle.asElement();
  assert(el, `應找到「${name}」的選擇按鈕`);
  await el.click();
}

async function createTestMenu(browser) {
  const page = await browser.newPage();
  await loginAsMockAdmin(page, BASE_URL);

  const menuDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
  await setInputValue(page, "#menuDate", menuDate);
  await page.type("#storeName", `LIFF測試店家_${Date.now()}`);
  await setInputValue(page, "#cutoffTime", `${menuDate}T23:00`);
  const nameInput = await page.$('input[name="itemName"]');
  const priceInput = await page.$('input[name="itemPrice"]');
  await nameInput.type("測試便當");
  await priceInput.type("80");
  await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);

  const menuLinkHandle = await page.evaluateHandle(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    return rows[0] ? rows[0].querySelector("a") : null;
  });
  await Promise.all([menuLinkHandle.asElement().click(), page.waitForNetworkIdle()]);
  const menuId = page.url().split("/").pop();
  await page.close();
  return menuId;
}

async function closeTestMenu(browser, menuId) {
  // 注意：不再呼叫 loginAsMockAdmin —— 同一個 browser context 已經有登入
  // session cookie，再導去 /login 會被 proxy.ts 直接導回 /admin，
  // 等不到 #email 欄位。
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/admin/menus/${menuId}`, { waitUntil: "networkidle0" });
  await page.click("#close-menu-submit");
  await page.waitForFunction(() => document.body.innerText.includes("已結單"), { timeout: 20000 });
  await page.close();
}

async function main() {
  console.log(`[e2e:liff-order] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:liff-order] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch({ protocolTimeout: 60000 });
    try {
      const menuId = await createTestMenu(browser);
      console.log("[e2e:liff-order] 測試用 menuId =", menuId);

      // --- 1~2. LIFF 頁面：模擬身分 -> 選名字綁定 ---
      const liffPage = await browser.newPage();
      await liffPage.goto(`${BASE_URL}/liff/order?menuId=${menuId}`, { waitUntil: "networkidle0" });

      await liffPage.waitForSelector("#dev-line-user-id");
      await liffPage.type("#dev-line-user-id", TEST_LINE_USER_ID);
      await liffPage.click("#dev-identity-submit");

      await liffPage.waitForSelector("#unbound-employee-list");
      const listText = await liffPage.$eval("#unbound-employee-list", (el) => el.innerText);
      assert(!listText.includes("王小明"), "已綁定的王小明不應出現在名單中");
      assert(listText.includes("陳小華"), "陳小華應出現在尚未綁定名單中");
      console.log("[e2e:liff-order] ✅ 未綁定身分正確顯示「尚未綁定」員工名單");

      await clickEmployeeButton(liffPage, "陳小華");
      await liffPage.waitForSelector("#submit-order-button");
      console.log("[e2e:liff-order] ✅ 選擇姓名後成功進入點餐頁面");

      // --- 3. 送出訂單 ---
      const qtyInput = await liffPage.$('input[id^="qty-"]');
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.type("2");
      await Promise.all([
        liffPage.click("#submit-order-button"),
        liffPage.waitForNetworkIdle(),
      ]);
      let bodyText = await liffPage.evaluate(() => document.body.innerText);
      assert(bodyText.includes("訂單已送出"), `應顯示送出成功訊息，實際：${bodyText}`);
      console.log("[e2e:liff-order] ✅ 送出訂單成功");

      // --- 4. 重新整理 + 同一身分再登入 -> 直接進點餐頁、訂單已預填 ---
      await liffPage.goto(`${BASE_URL}/liff/order?menuId=${menuId}`, { waitUntil: "networkidle0" });
      await liffPage.waitForSelector("#dev-line-user-id");
      await liffPage.type("#dev-line-user-id", TEST_LINE_USER_ID);
      await liffPage.click("#dev-identity-submit");
      await liffPage.waitForSelector("#submit-order-button");
      const qtyValueAfterReload = await liffPage.$eval('input[id^="qty-"]', (el) => el.value);
      assert(qtyValueAfterReload === "2", `重新登入後應預填數量 2，實際：${qtyValueAfterReload}`);
      bodyText = await liffPage.evaluate(() => document.body.innerText);
      assert(bodyText.includes("您已送出訂單"), "應顯示已送出訂單的狀態提示");
      console.log("[e2e:liff-order] ✅ 同一身分重新登入直接進點餐頁，且訂單已預填");

      // --- 5. 取消訂單 -> 重新點餐 ---
      await Promise.all([liffPage.click("#cancel-order-button"), liffPage.waitForNetworkIdle()]);
      bodyText = await liffPage.evaluate(() => document.body.innerText);
      assert(bodyText.includes("已取消訂單"), `應顯示取消成功訊息，實際：${bodyText}`);
      console.log("[e2e:liff-order] ✅ 取消訂單成功");

      await Promise.all([
        liffPage.click("#submit-order-button"),
        liffPage.waitForNetworkIdle(),
      ]);
      bodyText = await liffPage.evaluate(() => document.body.innerText);
      assert(bodyText.includes("訂單已送出"), "取消後應可重新送出訂單");
      console.log("[e2e:liff-order] ✅ 取消後重新點餐成功（訂單復活為 pending）");

      // --- 6. 助理結單後，LIFF 頁面應顯示已截止、輸入停用 ---
      await closeTestMenu(browser, menuId);

      await liffPage.goto(`${BASE_URL}/liff/order?menuId=${menuId}`, { waitUntil: "networkidle0" });
      await liffPage.waitForSelector("#dev-line-user-id");
      await liffPage.type("#dev-line-user-id", TEST_LINE_USER_ID);
      await liffPage.click("#dev-identity-submit");
      await liffPage.waitForFunction(
        () => document.body.innerText.includes("已截止收單"),
        { timeout: 20000 }
      );
      const submitButtonExists = await liffPage.$("#submit-order-button");
      assert(!submitButtonExists, "截止後不應顯示送出按鈕");
      const qtyDisabled = await liffPage.$eval('input[id^="qty-"]', (el) => el.disabled);
      assert(qtyDisabled, "截止後數量輸入框應為停用狀態");
      console.log("[e2e:liff-order] ✅ 截止收單後 LIFF 頁面正確鎖定，無法再點餐");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:liff-order] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
