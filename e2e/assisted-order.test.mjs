// E2E 測試：助理代客新增/修改訂單
// 用法：npm run test:e2e:assisted-order
//
// 涵蓋情境：
//   1. 助理在菜單詳細頁選員工、填數量送出 -> 出現在訂單列表，來源標示「助理代下」
//   2. 修改同一位員工的訂單數量 -> 金額更新（upsert，不是新增一筆）
//   3. 取消該員工訂單 -> 狀態變成已取消
//   4. 結單後（menu.status != open），助理仍可代客新增訂單（不受收單狀態限制）
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin, createAdminEmployee } from "./utils.mjs";

const PORT = 3116;
const BASE_URL = `http://localhost:${PORT}`;
const EMPLOYEE_A = `代客測試甲_${Date.now()}`;
const EMPLOYEE_B = `代客測試乙_${Date.now()}`;

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

/** 在 #assisted-employee-select 裡依員工姓名找 option value，然後選取 */
async function selectEmployee(page, name) {
  const value = await page.evaluate((n) => {
    const options = Array.from(document.querySelectorAll("#assisted-employee-select option"));
    const opt = options.find((o) => o.textContent.trim() === n);
    return opt ? opt.value : "";
  }, name);
  assert(value, `應找到員工「${name}」的 option`);
  await page.select("#assisted-employee-select", value);
}

async function main() {
  console.log(`[e2e:assisted-order] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:assisted-order] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      // 建立測試用員工（EMPLOYEE_A 用於步驟 1~3，EMPLOYEE_B 用於步驟 4）
      await createAdminEmployee(page, EMPLOYEE_A, BASE_URL);
      await createAdminEmployee(page, EMPLOYEE_B, BASE_URL);

      // 建立一張測試菜單
      const menuDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const menuStoreName = `代客點餐測試店家_${Date.now()}`;
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", menuDate);
      await page.type("#storeName", menuStoreName);
      await setInputValue(page, "#cutoffTime", `${menuDate}T23:00`);
      const nameInput = await page.$('input[name="itemName"]');
      const priceInput = await page.$('input[name="itemPrice"]');
      await nameInput.type("測試便當");
      await priceInput.type("80");
      await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);

      const linkHandle = await page.evaluateHandle((storeName) => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        const row = rows.find((r) => r.textContent.includes(storeName));
        return row ? row.querySelector("a") : null;
      }, menuStoreName);
      await Promise.all([linkHandle.asElement().click(), page.waitForNetworkIdle()]);

      // 展開「助理代客新增/修改訂單」區塊
      await page.evaluate(() => {
        document.querySelector("details").open = true;
      });

      // 1. 選擇 EMPLOYEE_A，數量填 2，送出
      await selectEmployee(page, EMPLOYEE_A);
      const qtyInput = await page.$('input[name="quantity"]');
      await qtyInput.evaluate((el) => (el.value = ""));
      await qtyInput.type("2");
      await Promise.all([page.click("#assisted-order-submit"), page.waitForNetworkIdle()]);

      let bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("已更新該員工的訂單"), `應顯示成功訊息，實際：${bodyText}`);
      assert(bodyText.includes(EMPLOYEE_A) && bodyText.includes("助理代下"), `訂單列表應顯示 ${EMPLOYEE_A}、來源為助理代下`);
      assert(bodyText.includes("$160"), `數量2 x 單價80 應顯示 $160，實際畫面：${bodyText}`);
      console.log("[e2e:assisted-order] ✅ 助理代客新增訂單成功，列表正確顯示");

      // 2. 修改同一位員工數量為 3（upsert，不應該變成兩筆）
      await page.evaluate(() => { document.querySelector("details").open = true; });
      await selectEmployee(page, EMPLOYEE_A);
      const qtyInput2 = await page.$('input[name="quantity"]');
      const prefilled = await qtyInput2.evaluate((el) => el.value);
      assert(prefilled === "2", `重新選擇 ${EMPLOYEE_A} 應預填上次數量 2，實際：${prefilled}`);
      await qtyInput2.evaluate((el) => (el.value = ""));
      await qtyInput2.type("3");
      await Promise.all([page.click("#assisted-order-submit"), page.waitForNetworkIdle()]);
      bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("$240"), `修改後數量3 x 80 應顯示 $240，實際：${bodyText}`);
      const tableText = await page.$eval("#assisted-orders-table", (el) => el.innerText);
      // 分割計算出現次數，避免 regex 特殊字元問題
      const occurrences = tableText.split(EMPLOYEE_A).length - 1;
      assert(occurrences === 1, `訂單列表的 ${EMPLOYEE_A} 應只出現 1 次（upsert 不應變成兩筆），實際出現 ${occurrences} 次`);
      console.log("[e2e:assisted-order] ✅ 修改訂單為 upsert，金額正確更新且沒有重複");

      // 3. 取消該員工訂單
      const cancelButtonHandle = await page.evaluateHandle((name) => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        const row = rows.find((r) => r.textContent.includes(name));
        return row ? row.querySelector('button[type="submit"]') : null;
      }, EMPLOYEE_A);
      await Promise.all([cancelButtonHandle.asElement().click(), page.waitForNetworkIdle()]);
      bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("已取消"), `取消後應顯示已取消狀態，實際：${bodyText}`);
      console.log("[e2e:assisted-order] ✅ 取消員工訂單成功");

      // 4. 結單後，助理仍可代客新增訂單
      await Promise.all([page.click("#close-menu-submit"), page.waitForNetworkIdle()]);
      bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("已結單"), "應先確認菜單已結單");

      await page.evaluate(() => { document.querySelector("details").open = true; });
      await selectEmployee(page, EMPLOYEE_B);
      const qtyInput3 = await page.$('input[name="quantity"]');
      await qtyInput3.evaluate((el) => (el.value = ""));
      await qtyInput3.type("1");
      await Promise.all([page.click("#assisted-order-submit"), page.waitForNetworkIdle()]);
      bodyText = await page.evaluate(() => document.body.innerText);
      assert(
        bodyText.includes("已更新該員工的訂單") && bodyText.includes(EMPLOYEE_B),
        `結單後助理應仍可代客下單成功，實際：${bodyText}`
      );
      console.log("[e2e:assisted-order] ✅ 結單後助理仍可代客新增訂單（不受收單狀態限制）");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:assisted-order] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
