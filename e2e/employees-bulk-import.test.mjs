// E2E 測試：員工名冊批次匯入
// 用法：npm run test:e2e:employees-bulk
//
// 涵蓋情境：
//   1. 展開批次匯入區塊，貼上多行姓名（含一個跟現有員工重複的姓名）送出
//   2. 應顯示「成功新增 N 位」「略過 1 位」的結果摘要
//   3. 成功新增的姓名應出現在員工列表中
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin, createAdminEmployee } from "./utils.mjs";

const PORT = 3109;
const BASE_URL = `http://localhost:${PORT}`;
const NAME_A = `批次測試A_${Date.now()}`;
const NAME_B = `批次測試B_${Date.now()}`;
const DUPLICATE_NAME = `批次重複_${Date.now()}`;

async function main() {
  console.log(`[e2e:employees-bulk] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:employees-bulk] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      // 先建立 DUPLICATE_NAME，供批次匯入「略過」情境使用
      await createAdminEmployee(page, DUPLICATE_NAME, BASE_URL);

      // 展開 <details> 批次匯入區塊（Server Action 後頁面重新渲染，需重新展開）
      await page.click("details summary");

      // 貼上：兩個新名字 + 一個已存在的重複姓名（DUPLICATE_NAME）
      const pasted = `${NAME_A}\n${NAME_B}\n${DUPLICATE_NAME}`;
      await page.type("#namesText", pasted);

      await Promise.all([
        page.click("#bulk-import-submit"),
        page.waitForNetworkIdle(),
      ]);

      const resultText = await page.$eval("#bulk-import-result", (el) => el.textContent);
      assert(resultText.includes("成功新增 2 位"), `應顯示成功新增 2 位，實際：${resultText}`);
      assert(resultText.includes("略過 1 位"), `應顯示略過 1 位，實際：${resultText}`);
      assert(resultText.includes("已存在"), `略過原因應說明已存在，實際：${resultText}`);
      console.log("[e2e:employees-bulk] ✅ 結果摘要正確顯示成功/略過數量與原因");

      const tableText = await page.$eval("table", (el) => el.innerText);
      assert(tableText.includes(NAME_A), `列表應看到「${NAME_A}」`);
      assert(tableText.includes(NAME_B), `列表應看到「${NAME_B}」`);
      console.log("[e2e:employees-bulk] ✅ 成功匯入的姓名出現在員工列表中");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:employees-bulk] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
