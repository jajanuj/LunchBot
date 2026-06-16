// E2E 煙霧測試：確認 Next.js 開發伺服器可正常啟動，且首頁能成功渲染。
// 用法：npm run test:e2e
//
// 流程：啟動 `next dev` -> 等待 port 就緒 -> 用 Puppeteer 開啟首頁 -> 檢查內容 -> 關閉伺服器。
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";

const PORT = 3100; // 避免與開發中的 3000 port 衝突
const URL = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 60_000;

function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`等待 dev server 啟動逾時，目前輸出：\n${output}`));
    }, READY_TIMEOUT_MS);

    const onData = (data) => {
      output += data.toString();
      if (/Ready in|started server/i.test(output)) {
        clearTimeout(timer);
        resolve();
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`dev server 提早結束，exit code: ${code}\n${output}`));
      }
    });
  });
}

async function main() {
  console.log(`[e2e] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e] dev server 已就緒，開啟瀏覽器測試首頁...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();
      const response = await page.goto(URL, { waitUntil: "networkidle0", timeout: 30_000 });

      if (!response || response.status() !== 200) {
        throw new Error(`首頁回應狀態異常：${response ? response.status() : "無回應"}`);
      }

      const bodyText = await page.evaluate(() => document.body.innerText);
      if (!bodyText || bodyText.trim().length === 0) {
        throw new Error("首頁內容為空，頁面可能未正確渲染");
      }

      console.log("[e2e] ✅ 首頁成功渲染，內容長度：", bodyText.trim().length);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    server.kill();
  }

  process.exit(exitCode);
}

main();
