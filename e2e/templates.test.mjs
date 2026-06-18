// E2E 測試：歷史店家樣板管理（/admin/templates）
// 用法：npm run test:e2e:templates
//
// 涵蓋情境：
//   1. 建立含樣板的菜單 -> 樣板出現在 /admin/templates 列表
//   2. 進入編輯頁 -> 修改店家名稱與品項 -> 儲存 -> 列表反映變更
//   3. 刪除樣板 -> 從列表消失
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3120;
const BASE_URL = `http://localhost:${PORT}`;
const ORIG_STORE = `樣板測試店_${Date.now()}`;
const RENAMED_STORE = `改名後店家_${Date.now()}`;

function futureDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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
  console.log(`[e2e:templates] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:templates] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      // 1. 建立一張菜單並勾選存為樣板
      const menuDate = futureDateString(5);
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(page, "#menuDate", menuDate);
      await page.type("#storeName", ORIG_STORE);
      await setInputValue(page, "#cutoffTime", `${menuDate}T11:30`);
      await (await page.$('input[name="itemName"]')).type("原始品項A");
      await (await page.$('input[name="itemPrice"]')).type("100");
      // 勾選存為樣板
      await page.evaluate(() => {
        const cb = document.querySelector('input[name="saveAsTemplate"]');
        if (cb) cb.checked = true;
      });
      await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);
      assert(page.url() === `${BASE_URL}/admin/menus`, `建立菜單後應回到列表，實際：${page.url()}`);

      // 確認樣板出現在 /admin/templates
      await page.goto(`${BASE_URL}/admin/templates`, { waitUntil: "networkidle0" });
      let pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(ORIG_STORE), `樣板列表應看到「${ORIG_STORE}」`);
      console.log("[e2e:templates] ✅ 建立菜單後樣板出現在列表");

      // 2. 點擊編輯連結
      const editLinkHandle = await page.evaluateHandle((name) => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        const row = rows.find((r) => r.textContent.includes(name));
        return row ? row.querySelector("a") : null;
      }, ORIG_STORE);
      assert(editLinkHandle.asElement(), "應找到編輯連結");
      await Promise.all([editLinkHandle.asElement().click(), page.waitForNetworkIdle()]);
      assert(page.url().includes("/admin/templates/"), `應進入編輯頁，實際：${page.url()}`);

      // 修改店家名稱
      const storeInput = await page.$("#storeName");
      await storeInput.evaluate((el) => (el.value = ""));
      await storeInput.type(RENAMED_STORE);

      // 修改第一個品項名稱
      const firstItemInput = await page.$('input[name="itemName"]');
      await firstItemInput.evaluate((el) => (el.value = ""));
      await firstItemInput.type("修改後品項B");

      // 新增第二個品項
      await page.click("#add-template-item-row");
      const itemInputs = await page.$$('input[name="itemName"]');
      await itemInputs[1].type("新增品項C");
      const priceInputs = await page.$$('input[name="itemPrice"]');
      await priceInputs[1].evaluate((el) => (el.value = "150"));

      await Promise.all([page.click("#update-template-submit"), page.waitForNetworkIdle()]);
      assert(page.url() === `${BASE_URL}/admin/templates`, `儲存後應回到列表，實際：${page.url()}`);

      pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(RENAMED_STORE), `列表應顯示新店家名稱「${RENAMED_STORE}」`);
      assert(!pageText.includes(ORIG_STORE), `舊店家名稱「${ORIG_STORE}」不應再出現`);
      // 品項數應為 2（修改後品項B + 新增品項C）
      const rows = await page.$$("tbody tr");
      const updatedRowText = await page.evaluate((name) => {
        const trs = Array.from(document.querySelectorAll("tbody tr"));
        const row = trs.find((r) => r.textContent.includes(name));
        return row ? row.innerText : "";
      }, RENAMED_STORE);
      assert(updatedRowText.includes("2"), `修改後品項數應為 2，實際：${updatedRowText}`);
      console.log("[e2e:templates] ✅ 編輯店家名稱與品項成功，列表正確更新");

      // 3. 刪除樣板
      const deleteFormHandle = await page.evaluateHandle((name) => {
        const trs = Array.from(document.querySelectorAll("tbody tr"));
        const row = trs.find((r) => r.textContent.includes(name));
        return row ? row.querySelector('button[type="submit"]') : null;
      }, RENAMED_STORE);
      assert(deleteFormHandle.asElement(), "應找到刪除按鈕");
      await Promise.all([deleteFormHandle.asElement().click(), page.waitForNavigation({ waitUntil: "networkidle0" })]);
      pageText = await page.evaluate(() => document.body.innerText);
      assert(!pageText.includes(RENAMED_STORE), `刪除後不應看到「${RENAMED_STORE}」`);
      console.log("[e2e:templates] ✅ 刪除樣板成功");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:templates] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
