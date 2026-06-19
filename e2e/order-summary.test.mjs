// E2E 測試：收單後彙整（叫貨清單 + 個人對帳清單）
// 用法：npm run test:e2e:order-summary
//
// 涵蓋情境：
//   1. 建立菜單，助理代客新增 2 筆訂單
//   2. 菜單詳情頁「店家叫貨清單」展開後顯示正確品項與數量
//   3. 「個人對帳清單」展開後顯示正確員工與金額
//   4. 「匯出 CSV」與「推播叫貨清單」按鈕存在
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin, createAdminEmployee } from "./utils.mjs";

const PORT = 3122;
const BASE_URL = `http://localhost:${PORT}`;
const EMP_A = `彙整甲_${Date.now()}`;
const EMP_B = `彙整乙_${Date.now()}`;

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
  console.log(`[e2e:order-summary] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:order-summary] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      // 建立測試員工
      await createAdminEmployee(page, EMP_A, BASE_URL);
      await createAdminEmployee(page, EMP_B, BASE_URL);

      // 建立測試菜單（2 個品項）
      const menuDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const storeName = `彙整測試店家_${Date.now()}`;
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", menuDate);
      await page.type("#storeName", storeName);
      await setInputValue(page, "#cutoffTime", `${menuDate}T23:00`);
      await (await page.$('input[name="itemName"]')).type("便當A");
      await (await page.$('input[name="itemPrice"]')).type("80");
      await page.click("#add-item-row");
      const nameInputs = await page.$$('input[name="itemName"]');
      const priceInputs = await page.$$('input[name="itemPrice"]');
      await nameInputs[1].type("便當B");
      await priceInputs[1].evaluate((el) => (el.value = "100"));
      await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);
      assert(page.url() === `${BASE_URL}/admin/menus`, `應回到菜單列表，實際：${page.url()}`);

      // 進入詳細頁（從卡片的「查看詳細」連結）
      const linkHandle = await page.evaluateHandle((name) => {
        const cards = Array.from(document.querySelectorAll("[data-menu-store]"));
        const card = cards.find((c) => c.getAttribute("data-menu-store") === name);
        return card ? card.querySelector("a") : null;
      }, storeName);
      assert(linkHandle.asElement(), "應找到菜單查看連結");
      await linkHandle.asElement().click();
      await page.waitForSelector("details", { timeout: 20000 });

      // EMP_A 點 便當A × 2
      await page.evaluate(() => { document.getElementById("assisted-order-details").open = true; });
      await selectEmployee(page, EMP_A);
      const qtyInputs = await page.$$('input[name="quantity"]');
      await qtyInputs[0].evaluate((el) => (el.value = "2")); // 便當A × 2
      await Promise.all([page.click("#assisted-order-submit"), page.waitForNetworkIdle()]);

      // EMP_B 點 便當B × 1
      await page.evaluate(() => { document.getElementById("assisted-order-details").open = true; });
      await selectEmployee(page, EMP_B);
      const qtyInputs2 = await page.$$('input[name="quantity"]');
      await qtyInputs2[1].evaluate((el) => (el.value = "1")); // 便當B × 1
      await Promise.all([page.click("#assisted-order-submit"), page.waitForNetworkIdle()]);

      // 驗證店家叫貨清單
      await page.evaluate(() => {
        document.getElementById("store-order-summary").open = true;
      });
      const storeSummaryText = await page.$eval("#store-order-summary", (el) => el.innerText);
      assert(storeSummaryText.includes("便當A"), `叫貨清單應顯示便當A，實際：${storeSummaryText}`);
      assert(storeSummaryText.includes("便當B"), `叫貨清單應顯示便當B，實際：${storeSummaryText}`);
      // EMP_A 便當A×2=$160, EMP_B 便當B×1=$100 -> 合計 3份 $260
      assert(storeSummaryText.includes("$160"), `便當A小計應為 $160，實際：${storeSummaryText}`);
      assert(storeSummaryText.includes("$100"), `便當B小計應為 $100，實際：${storeSummaryText}`);
      assert(storeSummaryText.includes("$260"), `合計應為 $260，實際：${storeSummaryText}`);
      console.log("[e2e:order-summary] ✅ 店家叫貨清單顯示正確品項與金額");

      // 驗證「推播叫貨清單」按鈕存在
      const pushBtn = await page.$("#push-order-summary-submit");
      assert(pushBtn, "應存在「推播叫貨清單至 LINE 群組」按鈕");
      console.log("[e2e:order-summary] ✅ 推播叫貨清單按鈕存在");

      // 驗證個人對帳清單
      await page.evaluate(() => {
        document.getElementById("billing-summary").open = true;
      });
      const billingText = await page.$eval("#billing-summary", (el) => el.innerText);
      assert(billingText.includes(EMP_A), `對帳清單應顯示 ${EMP_A}，實際：${billingText}`);
      assert(billingText.includes(EMP_B), `對帳清單應顯示 ${EMP_B}，實際：${billingText}`);
      console.log("[e2e:order-summary] ✅ 個人對帳清單顯示正確員工");

      // 驗證「匯出 CSV」按鈕存在
      const csvBtn = await page.$("#export-billing-csv");
      assert(csvBtn, "應存在「匯出對帳清單（CSV）」按鈕");
      console.log("[e2e:order-summary] ✅ 匯出 CSV 按鈕存在");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:order-summary] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
