// E2E 測試：月結薪資扣款
// 用法：npm run test:e2e:payroll
//
// 涵蓋情境：
//   1. 建立菜單 + 2 名員工 + 各下 1 筆訂單
//   2. 進入 /admin/payroll，選擇帳期，點選「產生扣款紀錄」
//   3. 驗證員工彙整表格顯示正確員工與合計金額
//   4. 點選「匯出 CSV」按鈕（存在即可）
//   5. 點選「標記為已匯出」，驗證狀態變為「已匯出」
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import {
  waitForServerReady,
  killProcessTree,
  assert,
  loginAsMockAdmin,
  createAdminEmployee,
} from "./utils.mjs";

const PORT = 3124;
const BASE_URL = `http://localhost:${PORT}`;
const EMP_C = `薪資甲_${Date.now()}`;
const EMP_D = `薪資乙_${Date.now()}`;

function setInputValue(page, selector, value) {
  return page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return;
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
  console.log(`[e2e:payroll] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:payroll] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      // 1. 建立員工
      await createAdminEmployee(page, EMP_C, BASE_URL);
      await createAdminEmployee(page, EMP_D, BASE_URL);

      // 2. 建立菜單（今天或明天日期，品項各 $80/$100）
      const menuDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const storeName = `薪資測試店家_${Date.now()}`;
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", menuDate);
      await page.type("#storeName", storeName);
      await setInputValue(page, "#cutoffTime", `${menuDate}T23:00`);
      await (await page.$('input[name="itemName"]')).type("扣款便當甲");
      await (await page.$('input[name="itemPrice"]')).type("80");
      await page.click("#add-item-row");
      const nameInputs = await page.$$('input[name="itemName"]');
      const priceInputs = await page.$$('input[name="itemPrice"]');
      await nameInputs[1].type("扣款便當乙");
      await priceInputs[1].evaluate((el) => (el.value = "100"));
      await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);
      assert(page.url() === `${BASE_URL}/admin/menus`, `應回到菜單列表，實際：${page.url()}`);

      // 3. 進入詳細頁，代客下單
      const linkHandle = await page.evaluateHandle((name) => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        const row = rows.find((r) => r.textContent.includes(name));
        return row ? row.querySelector("a") : null;
      }, storeName);
      assert(linkHandle.asElement(), "應找到菜單查看連結");
      await Promise.all([linkHandle.asElement().click(), page.waitForNavigation({ waitUntil: "networkidle0" })]);

      // EMP_C 點 扣款便當甲 × 1（$80）
      await page.evaluate(() => { document.getElementById("assisted-order-details").open = true; });
      await selectEmployee(page, EMP_C);
      const qtyInputs = await page.$$('input[name="quantity"]');
      await qtyInputs[0].evaluate((el) => (el.value = "1"));
      await Promise.all([page.click("#assisted-order-submit"), page.waitForNetworkIdle()]);

      // EMP_D 點 扣款便當乙 × 1（$100）
      await page.evaluate(() => { document.getElementById("assisted-order-details").open = true; });
      await selectEmployee(page, EMP_D);
      const qtyInputs2 = await page.$$('input[name="quantity"]');
      await qtyInputs2[1].evaluate((el) => (el.value = "1"));
      await Promise.all([page.click("#assisted-order-submit"), page.waitForNetworkIdle()]);

      console.log("[e2e:payroll] ✅ 建立測試訂單完成");

      // 4. 前往薪資扣款頁
      const billingPeriod = menuDate.slice(0, 7); // YYYY-MM
      await page.goto(`${BASE_URL}/admin/payroll?period=${billingPeriod}`, { waitUntil: "networkidle0" });
      const bodyText0 = await page.evaluate(() => document.body.innerText);
      assert(bodyText0.includes("月結薪資扣款"), `應顯示薪資扣款標題，實際：${bodyText0}`);
      console.log("[e2e:payroll] ✅ 進入薪資扣款頁面");

      // 5. 點選「產生扣款紀錄」
      await Promise.all([page.click("#generate-payroll-submit"), page.waitForNetworkIdle()]);
      // 等待 Client component fetch 完成
      await new Promise((r) => setTimeout(r, 1500));

      const bodyText1 = await page.evaluate(() => document.body.innerText);
      assert(bodyText1.includes(EMP_C), `彙整表格應顯示 ${EMP_C}，實際：${bodyText1}`);
      assert(bodyText1.includes(EMP_D), `彙整表格應顯示 ${EMP_D}，實際：${bodyText1}`);
      assert(bodyText1.includes("$80"), `應顯示 $80，實際：${bodyText1}`);
      assert(bodyText1.includes("$100"), `應顯示 $100，實際：${bodyText1}`);
      console.log("[e2e:payroll] ✅ 員工扣款彙整顯示正確");

      // 6. 匯出 CSV 按鈕存在
      const csvBtn = await page.$("#export-payroll-csv");
      assert(csvBtn, "應存在「匯出 CSV」按鈕");
      console.log("[e2e:payroll] ✅ 匯出 CSV 按鈕存在");

      // 7. 標記為已匯出
      const markBtn = await page.$("#mark-payroll-exported-submit");
      assert(markBtn, "應存在「標記為已匯出」按鈕");
      await Promise.all([markBtn.click(), page.waitForNetworkIdle()]);
      await new Promise((r) => setTimeout(r, 1500));

      const bodyText2 = await page.evaluate(() => document.body.innerText);
      assert(bodyText2.includes("已匯出"), `標記後應顯示「已匯出」狀態，實際：${bodyText2}`);
      const markBtnAfter = await page.$("#mark-payroll-exported-submit");
      assert(!markBtnAfter, "所有記錄已匯出後，標記按鈕應消失");
      console.log("[e2e:payroll] ✅ 標記為已匯出成功，狀態正確更新");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:payroll] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
