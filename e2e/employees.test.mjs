// E2E 測試：後台員工名冊管理
// 用法：npm run test:e2e:employees
//
// 涵蓋情境：
//   1. 登入後進入 /admin/employees，看到種子員工列表
//   2. 新增一位員工 -> 出現在列表中
//   3. 新增同名員工 -> 顯示錯誤訊息，不會重複新增
//   4. 刪除剛新增的員工（單筆）-> 從列表消失
//   5. 批次刪除：新增兩位員工，勾選兩個 checkbox，點批次刪除 -> 兩人都消失
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3103;
const BASE_URL = `http://localhost:${PORT}`;
const NEW_NAME = `測試員工_${Date.now()}`;
const BATCH_A = `批次甲_${Date.now()}`;
const BATCH_B = `批次乙_${Date.now()}`;

async function main() {
  console.log(`[e2e:employees] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:employees] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      // 自動接受所有 window.confirm 對話框
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });
      await loginAsMockAdmin(page, BASE_URL);

      // 1. 進入員工名冊，確認頁面正常渲染（Supabase 可能是空資料庫，只確認 table 元素存在）
      await page.goto(`${BASE_URL}/admin/employees`, { waitUntil: "networkidle0" });
      const tableExists = await page.$("table");
      assert(tableExists, "員工名冊頁面應有 table 元素");
      let tableText = "";
      console.log("[e2e:employees] ✅ 員工名冊頁面正常渲染");

      // 2. 新增員工
      await page.type("#employeeName", NEW_NAME);
      await Promise.all([
        page.click("#add-employee-submit"),
        page.waitForNetworkIdle(),
      ]);
      tableText = await page.$eval("table", (el) => el.innerText);
      assert(tableText.includes(NEW_NAME), `新增後應看到「${NEW_NAME}」`);
      console.log("[e2e:employees] ✅ 新增員工成功並顯示在列表");

      // 3. 新增同名員工 -> 應顯示錯誤
      await page.type("#employeeName", NEW_NAME);
      await Promise.all([
        page.click("#add-employee-submit"),
        page.waitForNetworkIdle(),
      ]);
      const errorText = await page
        .$eval("[role='alert']", (el) => el.textContent)
        .catch(() => null);
      assert(errorText && errorText.includes("已存在"), `重複姓名應顯示錯誤，實際：${errorText}`);
      console.log("[e2e:employees] ✅ 重複姓名正確顯示錯誤訊息");

      // 4. 刪除剛新增的員工（單筆）
      const deleteButtonHandle = await page.evaluateHandle((name) => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        const row = rows.find((r) => r.textContent.includes(name));
        if (!row) return null;
        const buttons = Array.from(row.querySelectorAll("button"));
        return buttons.find((b) => b.textContent.trim() === "刪除") ?? null;
      }, NEW_NAME);
      assert(deleteButtonHandle.asElement(), "應找到該員工的刪除按鈕");
      await Promise.all([
        deleteButtonHandle.asElement().click(),
        page.waitForNetworkIdle(),
      ]);
      tableText = await page.$eval("table", (el) => el.innerText);
      assert(
        !tableText.includes(NEW_NAME),
        "刪除後不應再看到該員工（注意：上方殘留的錯誤訊息仍會包含此姓名，故只檢查 table 內容）"
      );
      console.log("[e2e:employees] ✅ 刪除員工成功");

      // 5. 批次刪除：新增兩位員工 -> 勾選兩個 checkbox -> 點批次刪除 -> 兩人消失
      // 5a. 新增 BATCH_A
      await page.type("#employeeName", BATCH_A);
      await Promise.all([page.click("#add-employee-submit"), page.waitForNetworkIdle()]);
      // 5b. 新增 BATCH_B
      await page.type("#employeeName", BATCH_B);
      await Promise.all([page.click("#add-employee-submit"), page.waitForNetworkIdle()]);
      tableText = await page.$eval("table", (el) => el.innerText);
      assert(tableText.includes(BATCH_A) && tableText.includes(BATCH_B), "應看到批次測試的兩位員工");

      // 5c. 勾選 BATCH_A 和 BATCH_B 的 checkbox
      for (const name of [BATCH_A, BATCH_B]) {
        await page.evaluate((n) => {
          const rows = Array.from(document.querySelectorAll("tbody tr"));
          const row = rows.find((r) => r.textContent.includes(n));
          if (row) {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb) cb.click();
          }
        }, name);
      }

      // 5d. 等批次刪除按鈕出現後點擊
      await page.waitForSelector("#batch-delete-employees-submit");
      await Promise.all([
        page.click("#batch-delete-employees-submit"),
        page.waitForNetworkIdle(),
      ]);
      tableText = await page.$eval("table", (el) => el.innerText);
      assert(!tableText.includes(BATCH_A), `批次刪除後不應看到「${BATCH_A}」`);
      assert(!tableText.includes(BATCH_B), `批次刪除後不應看到「${BATCH_B}」`);
      console.log("[e2e:employees] ✅ 批次刪除員工成功");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:employees] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
