// E2E 測試：後台登入機制
// 用法：npm run test:e2e:login
//
// 涵蓋情境：
//   1. 未登入直接訪問 /admin -> 應被導向 /login
//   2. 輸入錯誤帳密 -> 顯示錯誤訊息，並停留在 /login
//   3. 輸入正確帳密（mock 帳號）-> 進入 /admin，看到歡迎內容
//   4. 點擊登出 -> 回到 /login，且再訪問 /admin 又被導回 /login
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert } from "./utils.mjs";

const PORT = 3101; // 與其他 e2e 測試使用不同 port，避免互相干擾
const BASE_URL = `http://localhost:${PORT}`;

const MOCK_EMAIL = process.env.MOCK_ADMIN_EMAIL ?? "admin@lunchbot.local";
const MOCK_PASSWORD = process.env.MOCK_ADMIN_PASSWORD ?? "changeme123";

async function main() {
  console.log(`[e2e:login] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, {
    shell: true,
    cwd: process.cwd(),
  });

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:login] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      const page = await browser.newPage();

      // 1. 未登入訪問 /admin -> 導向 /login
      await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
      assert(
        page.url().startsWith(`${BASE_URL}/login`),
        `未登入訪問 /admin 應導向 /login，實際 URL：${page.url()}`
      );
      console.log("[e2e:login] ✅ 未登入訪問 /admin 被正確導向 /login");

      // 2. 錯誤帳密 -> 顯示錯誤訊息
      await page.type("#email", "wrong@lunchbot.local");
      await page.type("#password", "wrongpassword");
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNetworkIdle(),
      ]);
      const errorText = await page
        .$eval("[role='alert']", (el) => el.textContent)
        .catch(() => null);
      assert(errorText && errorText.includes("錯誤"), `應顯示帳密錯誤訊息，實際：${errorText}`);
      assert(page.url().startsWith(`${BASE_URL}/login`), "帳密錯誤時應停留在 /login");
      console.log("[e2e:login] ✅ 錯誤帳密正確顯示錯誤訊息");

      // 3. 正確帳密 -> 進入 /admin
      await page.evaluate(() => {
        document.querySelector("#email").value = "";
        document.querySelector("#password").value = "";
      });
      await page.type("#email", MOCK_EMAIL);
      await page.type("#password", MOCK_PASSWORD);
      await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNetworkIdle(),
      ]);
      assert(
        page.url().startsWith(`${BASE_URL}/admin`),
        `登入成功應進入 /admin，實際 URL：${page.url()}`
      );
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert(bodyText.includes("後台首頁"), "登入後應看到後台首頁內容");
      console.log("[e2e:login] ✅ 正確帳密成功登入並看到後台內容");

      // 4. 登出 -> 回到 /login，且再訪問 /admin 又被導回 /login
      await Promise.all([
        page.click('button[type="submit"]'), // layout 裡的登出按鈕
        page.waitForNetworkIdle(),
      ]);
      assert(page.url().startsWith(`${BASE_URL}/login`), "登出後應回到 /login");

      await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
      assert(
        page.url().startsWith(`${BASE_URL}/login`),
        "登出後再訪問 /admin 應再次被導向 /login"
      );
      console.log("[e2e:login] ✅ 登出後 session 失效，正確導回 /login");
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:login] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
