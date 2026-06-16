// E2E 測試：後台菜單管理（手動輸入 + 歷史樣板套用）
// 用法：npm run test:e2e:menus
//
// 涵蓋情境：
//   1. 手動輸入建立菜單（2 個品項）-> 出現在列表中
//   2. 進入詳細頁看到正確的品項與價格
//   3. 結單 -> 狀態變成「已結單」
//   4. 套用歷史樣板（種子樣板「阿明便當」）-> 表單自動帶入店家與品項，送出後出現在列表
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3108;
const BASE_URL = `http://localhost:${PORT}`;

function futureDateString(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** date / datetime-local 這類輸入框用 page.type() 不可靠，直接設定 DOM value 並補發事件。 */
async function setInputValue(page, selector, value) {
  await page.evaluate(
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

async function main() {
  console.log(`[e2e:menus] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:menus] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      const menuDate1 = futureDateString(1);

      // 1. 手動輸入建立菜單
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", menuDate1);
      await page.type("#sessionName", "午餐");
      await page.type("#storeName", "測試小吃店");
      await setInputValue(page, "#cutoffTime", `${menuDate1}T11:30`);

      const nameInputs = await page.$$('input[name="itemName"]');
      const priceInputs = await page.$$('input[name="itemPrice"]');
      await nameInputs[0].type("雞腿飯");
      await priceInputs[0].type("90");
      await page.click("#add-item-row");
      const nameInputs2 = await page.$$('input[name="itemName"]');
      const priceInputs2 = await page.$$('input[name="itemPrice"]');
      await nameInputs2[1].type("排骨飯");
      await priceInputs2[1].type("85");

      await Promise.all([
        page.click("#create-menu-submit"),
        page.waitForNetworkIdle(),
      ]);
      assert(page.url() === `${BASE_URL}/admin/menus`, `建立後應回到菜單列表，實際：${page.url()}`);

      let tableText = await page.$eval("table", (el) => el.innerText);
      assert(tableText.includes("測試小吃店"), "列表應看到剛建立的店家");
      assert(tableText.includes("收單中"), "新菜單狀態應為收單中");
      console.log("[e2e:menus] ✅ 手動輸入建立菜單成功並顯示在列表");

      // 2. 進入詳細頁
      const detailLinkHandle = await page.evaluateHandle(() => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        const row = rows.find((r) => r.textContent.includes("測試小吃店"));
        return row ? row.querySelector("a") : null;
      });
      const detailLink = detailLinkHandle.asElement();
      assert(detailLink, "應找到查看連結");
      await Promise.all([detailLink.click(), page.waitForNetworkIdle()]);
      const detailText = await page.evaluate(() => document.body.innerText);
      assert(detailText.includes("雞腿飯") && detailText.includes("90"), "詳細頁應看到雞腿飯/90");
      assert(detailText.includes("排骨飯") && detailText.includes("85"), "詳細頁應看到排骨飯/85");
      console.log("[e2e:menus] ✅ 詳細頁正確顯示品項與價格");

      // 3. 結單
      await Promise.all([
        page.click("#close-menu-submit"),
        page.waitForNetworkIdle(),
      ]);
      const afterCloseText = await page.evaluate(() => document.body.innerText);
      assert(afterCloseText.includes("已結單"), "結單後狀態應顯示已結單");
      console.log("[e2e:menus] ✅ 結單後狀態正確變更");

      // 4. 套用歷史樣板
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      const templateOptionValue = await page.$eval(
        "#templateSelect option:nth-child(2)",
        (el) => el.value
      );
      await page.select("#templateSelect", templateOptionValue);
      const storeNameValue = await page.$eval("#storeName", (el) => el.value);
      assert(storeNameValue === "阿明便當", `套用樣板後店家名稱應為「阿明便當」，實際：${storeNameValue}`);
      const firstItemName = await page.$eval('input[name="itemName"]', (el) => el.value);
      assert(firstItemName.length > 0, "套用樣板後第一個品項名稱應自動帶入");
      console.log("[e2e:menus] ✅ 套用歷史樣板成功自動帶入店家與品項");

      const menuDate2 = futureDateString(2);
      await setInputValue(page, "#menuDate", menuDate2);
      await setInputValue(page, "#cutoffTime", `${menuDate2}T11:30`);
      await Promise.all([
        page.click("#create-menu-submit"),
        page.waitForNetworkIdle(),
      ]);
      tableText = await page.$eval("table", (el) => el.innerText);
      assert(tableText.includes("阿明便當"), "套用樣板建立的菜單應出現在列表");
      console.log("[e2e:menus] ✅ 套用樣板建立的菜單成功送出");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:menus] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
