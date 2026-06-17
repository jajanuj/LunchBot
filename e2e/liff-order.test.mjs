// E2E 測試：LIFF 點餐頁面（身分綁定 + 點餐 + 修改/取消 + 截止後鎖定）
// 用法：npm run test:e2e:liff-order
//
// LIFF 頁面在真實環境需要在 LINE App 裡開啟才能用 liff.getProfile() 拿到
// 真實身分，這部分需要真實 LINE 帳號，不適合自動化（也不應該用真帳號跑
// 測試腳本）。所以這裡走的是專案內建的「開發測試模式」身分模擬入口
// （只在 NODE_ENV !== 'production' 出現，正式 build 會被打包工具整段移除）。
//
// 涵蓋情境：
//   1. 模擬全新 LINE 身分 -> 顯示尚未綁定員工名單，LIFF_EMPLOYEE 應出現
//   2. 選擇姓名綁定 -> 進入點餐頁面
//   3. 送出訂單 -> 顯示成功訊息
//   4. 重新整理頁面、用同一個身分登入 -> 直接進點餐頁面且訂單內容已預填
//   5. 取消訂單 -> 重新點餐 -> 訂單復活成 pending
//   6. 助理把菜單結單後 -> LIFF 頁面顯示已截止、輸入框停用
//
// 備註：助理端所有操作（登入、建立員工、建立菜單、結單）都在同一個
// adminPage 完成，確保 session cookie 始終有效，不依賴跨 page 的 cookie 共享。
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin, createAdminEmployee } from "./utils.mjs";

const PORT = 3112;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_LINE_USER_ID = `Utest_e2e_${Date.now()}`;
const LIFF_EMPLOYEE = `LIFF員工_${Date.now()}`; // 前綴 7 字 + 13 位時間戳 = 20 字，在 varchar(20) 限制內

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

async function main() {
  console.log(`[e2e:liff-order] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:liff-order] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch({ protocolTimeout: 60000 });
    try {
      // ── 前置作業：在同一個 adminPage 登入、建立員工、建立菜單 ──
      const adminPage = await browser.newPage();
      await loginAsMockAdmin(adminPage, BASE_URL);

      // 建立測試用員工（與 adminPage 共用同一個已登入 session）
      await createAdminEmployee(adminPage, LIFF_EMPLOYEE, BASE_URL);
      // 確認員工確實出現在 table 中
      const empTableText = await adminPage.$eval("table", (el) => el.innerText);
      assert(empTableText.includes(LIFF_EMPLOYEE), `員工建立後應出現在 table，實際：${empTableText.slice(0, 200)}`);
      console.log("[e2e:liff-order] 測試員工已建立並確認在 table 中：", LIFF_EMPLOYEE);

      // 建立測試菜單
      const menuDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const liffStoreName = `LIFF測試店家_${Date.now()}`;
      await adminPage.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await setInputValue(adminPage, "#menuDate", menuDate);
      await adminPage.type("#storeName", liffStoreName);
      await setInputValue(adminPage, "#cutoffTime", `${menuDate}T23:00`);
      const nameInput = await adminPage.$('input[name="itemName"]');
      const priceInput = await adminPage.$('input[name="itemPrice"]');
      await nameInput.type("測試便當");
      await priceInput.type("80");
      await Promise.all([adminPage.click("#create-menu-submit"), adminPage.waitForNetworkIdle()]);

      // 進入詳細頁取得 menuId（依店家名稱找，不用 rows[0] 以免選到其他測試留下的菜單）
      const menuLinkHandle = await adminPage.evaluateHandle((storeName) => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        const row = rows.find((r) => r.textContent.includes(storeName));
        return row ? row.querySelector("a") : null;
      }, liffStoreName);
      await Promise.all([menuLinkHandle.asElement().click(), adminPage.waitForNetworkIdle()]);
      const menuId = adminPage.url().split("/").pop();
      console.log("[e2e:liff-order] 測試用 menuId =", menuId);
      // adminPage 的任務完成（登入 + 建立員工 + 建立菜單），關閉以避免後續 idle 導致 CDP timeout
      await adminPage.close();

      // --- 1~2. LIFF 頁面：模擬身分 -> 選名字綁定 ---
      const liffPage = await browser.newPage();
      await liffPage.goto(`${BASE_URL}/liff/order?menuId=${menuId}`, { waitUntil: "networkidle0" });

      await liffPage.waitForSelector("#dev-line-user-id");
      await liffPage.type("#dev-line-user-id", TEST_LINE_USER_ID);
      await liffPage.click("#dev-identity-submit");

      // 等待 Server Action 完成後員工出現在清單（list 出現時 unboundEmployees 已載入）
      await liffPage.waitForFunction(
        (name) => {
          const list = document.querySelector("#unbound-employee-list");
          return list && list.innerText.includes(name);
        },
        { timeout: 15000 },
        LIFF_EMPLOYEE
      );
      const listText = await liffPage.$eval("#unbound-employee-list", (el) => el.innerText);
      assert(listText.includes(LIFF_EMPLOYEE), `${LIFF_EMPLOYEE} 應出現在尚未綁定名單中，實際：${listText}`);
      console.log("[e2e:liff-order] ✅ 未綁定身分正確顯示「尚未綁定」員工名單");

      await clickEmployeeButton(liffPage, LIFF_EMPLOYEE);
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
      // 注意：adminPage 在 liffPage 操作多步驟期間長時間閒置，直接重用會觸發
      // Runtime.callFunctionOn timed out，需要開一個新 page 來結單。
      const closePage = await browser.newPage();
      await closePage.goto(`${BASE_URL}/admin/menus/${menuId}`, { waitUntil: "networkidle0" });
      await closePage.click("#close-menu-submit");
      await closePage.waitForFunction(
        () => document.body.innerText.includes("已結單"),
        { timeout: 20000 }
      );
      await closePage.close();

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
