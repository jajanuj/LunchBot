// E2E 測試：店家管理（/admin/stores）
// 用法：npm run test:e2e:stores
//
// 涵蓋情境：
//   1. 直接新增店家（不透過菜單）
//   2. 建立含「同步儲存至店家管理」的菜單 -> 店家出現在列表
//   3. 進入編輯頁 -> 修改店家名稱與品項 -> 儲存 -> 列表反映變更
//   4. 刪除店家 -> 從列表消失
//   5. 批次刪除多個店家 -> 全部從列表消失
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3120;
const BASE_URL = `http://localhost:${PORT}`;
const NEW_STORE = `直接新增店家_${Date.now()}`;
const ORIG_STORE = `樣板測試店_${Date.now()}`;
const RENAMED_STORE = `改名後店家_${Date.now()}`;
const BATCH_A = `批次店家甲_${Date.now()}`;
const BATCH_B = `批次店家乙_${Date.now()}`;

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

/** 建立一張菜單並勾選「同步儲存至店家管理」 */
async function createMenuWithStore(page, storeName, dateOffset = 5) {
  const menuDate = futureDateString(dateOffset);
  await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
  await setInputValue(page, "#menuDate", menuDate);
  await page.type("#storeName", storeName);
  await setInputValue(page, "#cutoffTime", `${menuDate}T11:30`);
  await (await page.$('input[name="itemName"]')).type("測試品項");
  await (await page.$('input[name="itemPrice"]')).type("80");
  await page.evaluate(() => {
    const cb = document.querySelector('input[name="saveAsStore"]');
    if (cb) cb.checked = true;
  });
  await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);
}

async function main() {
  console.log(`[e2e:stores] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:stores] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      page.on("dialog", async (dialog) => dialog.accept());
      await loginAsMockAdmin(page, BASE_URL);

      // 1. 直接新增店家
      await page.goto(`${BASE_URL}/admin/stores/new`, { waitUntil: "networkidle0" });
      await page.type("#storeName", NEW_STORE);
      await (await page.$('input[name="itemName"]')).type("直接新增品項");
      await (await page.$('input[name="itemPrice"]')).type("120");
      await Promise.all([page.click("#create-store-submit"), page.waitForNetworkIdle()]);
      assert(page.url() === `${BASE_URL}/admin/stores`, `新增後應回到列表，實際：${page.url()}`);
      let pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(NEW_STORE), `列表應看到「${NEW_STORE}」`);
      console.log("[e2e:stores] ✅ 直接新增店家成功");

      // 2. 建立菜單時同步儲存店家
      await createMenuWithStore(page, ORIG_STORE);
      assert(page.url() === `${BASE_URL}/admin/menus`, `建立菜單後應回到列表，實際：${page.url()}`);
      await page.goto(`${BASE_URL}/admin/stores`, { waitUntil: "networkidle0" });
      pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(ORIG_STORE), `店家列表應看到「${ORIG_STORE}」`);
      console.log("[e2e:stores] ✅ 建立菜單時同步儲存店家成功");

      // 3. 點擊編輯（從卡片的「編輯」連結）
      const editLinkHandle = await page.evaluateHandle((name) => {
        const cards = Array.from(document.querySelectorAll("[data-store-name]"));
        const card = cards.find((c) => c.getAttribute("data-store-name") === name);
        return card ? card.querySelector("a") : null;
      }, ORIG_STORE);
      assert(editLinkHandle.asElement(), "應找到編輯連結");
      await Promise.all([editLinkHandle.asElement().click(), page.waitForNetworkIdle()]);
      assert(page.url().includes("/admin/stores/"), `應進入編輯頁，實際：${page.url()}`);

      const storeInput = await page.$("#storeName");
      await storeInput.evaluate((el) => (el.value = ""));
      await storeInput.type(RENAMED_STORE);
      const firstItemInput = await page.$('input[name="itemName"]');
      await firstItemInput.evaluate((el) => (el.value = ""));
      await firstItemInput.type("修改後品項B");
      await page.click("#add-store-item-row");
      const itemInputs = await page.$$('input[name="itemName"]');
      await itemInputs[1].type("新增品項C");
      const priceInputs = await page.$$('input[name="itemPrice"]');
      await priceInputs[1].evaluate((el) => (el.value = "150"));

      await Promise.all([page.click("#update-store-submit"), page.waitForNetworkIdle()]);
      assert(page.url() === `${BASE_URL}/admin/stores`, `儲存後應回到列表，實際：${page.url()}`);
      pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(RENAMED_STORE), `列表應顯示新店家名稱「${RENAMED_STORE}」`);
      assert(!pageText.includes(ORIG_STORE), `舊店家名稱「${ORIG_STORE}」不應再出現`);
      // 從卡片取得品項數資訊
      const updatedCardText = await page.evaluate((name) => {
        const cards = Array.from(document.querySelectorAll("[data-store-name]"));
        const card = cards.find((c) => c.getAttribute("data-store-name") === name);
        return card ? card.innerText : "";
      }, RENAMED_STORE);
      assert(updatedCardText.includes("2"), `修改後品項數應為 2，實際：${updatedCardText}`);
      console.log("[e2e:stores] ✅ 編輯店家名稱與品項成功，列表正確更新");

      // 4. 刪除店家（單筆）- 從卡片找刪除按鈕
      const deleteBtn = await page.evaluateHandle((name) => {
        const cards = Array.from(document.querySelectorAll("[data-store-name]"));
        const card = cards.find((c) => c.getAttribute("data-store-name") === name);
        if (!card) return null;
        const btns = Array.from(card.querySelectorAll("button"));
        return btns.find((b) => b.textContent.trim() === "刪除") ?? null;
      }, RENAMED_STORE);
      assert(deleteBtn.asElement(), "應找到刪除按鈕");
      await deleteBtn.asElement().click();
      await page.waitForNetworkIdle();
      pageText = await page.evaluate(() => document.body.innerText);
      assert(!pageText.includes(RENAMED_STORE), `刪除後不應看到「${RENAMED_STORE}」`);
      console.log("[e2e:stores] ✅ 刪除店家成功");

      // 5. 批次刪除 - 從卡片找 checkbox
      await createMenuWithStore(page, BATCH_A, 6);
      await createMenuWithStore(page, BATCH_B, 7);
      await page.goto(`${BASE_URL}/admin/stores`, { waitUntil: "networkidle0" });
      pageText = await page.evaluate(() => document.body.innerText);
      assert(pageText.includes(BATCH_A), `列表應看到「${BATCH_A}」`);
      assert(pageText.includes(BATCH_B), `列表應看到「${BATCH_B}」`);

      await page.evaluate((nameA, nameB) => {
        const cards = Array.from(document.querySelectorAll("[data-store-name]"));
        for (const card of cards) {
          const name = card.getAttribute("data-store-name");
          if (name === nameA || name === nameB) {
            const cb = card.querySelector('input[type="checkbox"]');
            if (cb) cb.click();
          }
        }
      }, BATCH_A, BATCH_B);

      const batchBtn = await page.waitForSelector("#batch-delete-stores-submit");
      await batchBtn.click();
      await page.waitForNetworkIdle();
      pageText = await page.evaluate(() => document.body.innerText);
      assert(!pageText.includes(BATCH_A), `批次刪除後不應看到「${BATCH_A}」`);
      assert(!pageText.includes(BATCH_B), `批次刪除後不應看到「${BATCH_B}」`);
      console.log("[e2e:stores] ✅ 批次刪除店家成功");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:stores] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
