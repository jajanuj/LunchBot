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
const TEMPLATE_STORE = `E2E樣板_${Date.now()}`;  // 9 + 13 = 22 > 20，但這是 store_name（varchar 100），無長度問題
const MANUAL_STORE = `E2E手動_${Date.now()}`; // 步驟 1 的固定店名改為含時間戳，避免 (date, store_name) unique constraint 衝突

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

      // 0. 先建立「歷史樣板」，供後面步驟 4 套用（Supabase 是空資料庫，無種子樣板）
      const templateDate = futureDateString(3);
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", templateDate);
      await page.type("#storeName", TEMPLATE_STORE);
      await setInputValue(page, "#cutoffTime", `${templateDate}T11:30`);
      await (await page.$('input[name="itemName"]')).type("樣板便當");
      await (await page.$('input[name="itemPrice"]')).type("75");
      // 直接設定 checked 屬性（比 page.click 更可靠，避免 label 雙重觸發的問題）
      await page.evaluate(() => {
        const cb = document.querySelector('input[name="saveAsStore"]');
        if (cb) cb.checked = true;
      });
      const cbChecked = await page.$eval('input[name="saveAsStore"]', (el) => el.checked);
      assert(cbChecked, "saveAsStore checkbox 應為勾選狀態");
      await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);
      // 確認 step 0 已成功建立樣板（若失敗會停在 /menus/new）
      if (page.url() !== `${BASE_URL}/admin/menus`) {
        const errText = await page.$eval("[role='alert']", (el) => el.textContent).catch(() => "(無 alert)");
        throw new Error(`步驟 0 建立樣板菜單失敗，仍在 ${page.url()}，錯誤訊息：${errText}`);
      }
      console.log("[e2e:menus] ✅ 步驟 0 歷史樣板建立成功");

      const menuDate1 = futureDateString(1);

      // 1. 手動輸入建立菜單
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", menuDate1);
      await page.type("#sessionName", "午餐");
      await page.type("#storeName", MANUAL_STORE);
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

      // 卡片視圖：用 body.innerText 找可見文字
      let pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(MANUAL_STORE), "列表應看到剛建立的店家");
      assert(pageText.includes("收單中"), "新菜單狀態應為收單中");
      console.log("[e2e:menus] ✅ 手動輸入建立菜單成功並顯示在列表");

      // 2. 進入詳細頁（從卡片的「查看詳細」連結）
      const detailLinkHandle = await page.evaluateHandle((storeName) => {
        const cards = Array.from(document.querySelectorAll("[data-menu-store]"));
        const card = cards.find((c) => c.getAttribute("data-menu-store") === storeName);
        return card ? card.querySelector("a") : null;
      }, MANUAL_STORE);
      const detailLink = detailLinkHandle.asElement();
      assert(detailLink, "應找到查看連結");
      await detailLink.click();
      // 等到品項清單的 <details> 元素出現再展開（Server Component 串流渲染需要時間）
      await page.waitForSelector("details", { timeout: 20000 });
      await page.click("details > summary");
      const detailText = await page.evaluate(() => document.body.innerText);
      assert(detailText.includes("雞腿飯") && detailText.includes("90"), "詳細頁應看到雞腿飯/90");
      assert(detailText.includes("排骨飯") && detailText.includes("85"), "詳細頁應看到排骨飯/85");
      console.log("[e2e:menus] ✅ 詳細頁正確顯示品項與價格");

      // 3. 結單（等 React hydration 完成後點擊）
      const menuDetailUrl = page.url();
      // 等 Next.js hydration 完成（__next_f 陣列停止增長）
      await page.waitForFunction(() => document.readyState === "complete", { timeout: 10000 });
      await new Promise(r => setTimeout(r, 500)); // hydration 緩衝
      await Promise.all([
        page.click("#close-menu-submit"),
        page.waitForNetworkIdle(),
      ]);
      await page.goto(menuDetailUrl, { waitUntil: "networkidle0" });
      const afterCloseText = await page.evaluate(() => document.body.innerText);
      assert(afterCloseText.includes("已結單"), "結單後狀態應顯示已結單");
      console.log("[e2e:menus] ✅ 結單後狀態正確變更");

      // 4. 套用歷史樣板（依 TEMPLATE_STORE 名稱找 option，不用 nth-child 以免選到舊樣板）
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      const templateOptionValue = await page.evaluate((storeName) => {
        const options = Array.from(document.querySelectorAll("#storeSelect option"));
        const opt = options.find((o) => o.text === storeName);
        return opt ? opt.value : "";
      }, TEMPLATE_STORE);
      assert(templateOptionValue, `應在樣板下拉選單中找到「${TEMPLATE_STORE}」`);
      await page.select("#storeSelect", templateOptionValue);
      const storeNameValue = await page.$eval("#storeName", (el) => el.value);
      assert(storeNameValue === TEMPLATE_STORE, `套用樣板後店家名稱應為「${TEMPLATE_STORE}」，實際：${storeNameValue}`);
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
      pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(TEMPLATE_STORE), "套用樣板建立的菜單應出現在列表");
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
