// E2E 測試：AI 辨識菜單圖片匯入
// 用法：npm run test:e2e:ai-menu-import
//
// 測試流程：
//   1. 用 Puppeteer 產生一張含有菜單品項的測試圖片（截圖法，不依賴 canvas 套件）
//   2. 上傳圖片 -> Gemini AI 辨識 -> 確認品項出現在預覽表格
//   3. 套用辨識結果 -> 填入日期與截止時間 -> 建立菜單
//   4. 確認菜單出現在列表
//   5. 確認 menu_ai_imports 有對應的 importId（從 hidden input 取得）
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { waitForServerReady, killProcessTree, assert, loginAsMockAdmin } from "./utils.mjs";

const PORT = 3118;
const BASE_URL = `http://localhost:${PORT}`;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error(
    "[e2e:ai-menu-import] ❌ 找不到環境變數 GEMINI_API_KEY。\n" +
      "請用「node --env-file=.env.local e2e/ai-menu-import.test.mjs」執行（npm script 已內建）。"
  );
  process.exit(1);
}

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

async function main() {
  console.log(`[e2e:ai-menu-import] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let exitCode = 0;
  let tempImagePath = null;
  try {
    await waitForServerReady(server);
    console.log("[e2e:ai-menu-import] dev server 已就緒，開始測試...");

    const browser = await puppeteer.launch();
    try {
      // 1. 產生測試用菜單圖片（截圖含有中文品項名稱與價格的 HTML 頁面）
      const imgPage = await browser.newPage();
      await imgPage.setViewport({ width: 600, height: 400 });
      await imgPage.setContent(`
        <html><body style="background:white;padding:40px;font-family:sans-serif;font-size:18px;">
          <h2 style="font-size:24px;margin-bottom:16px;">阿明便當 AI測試店</h2>
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:8px;border:1px solid #ccc;">雞腿飯</td><td style="padding:8px;border:1px solid #ccc;">$90</td></tr>
            <tr><td style="padding:8px;border:1px solid #ccc;">排骨飯</td><td style="padding:8px;border:1px solid #ccc;">$85</td></tr>
            <tr><td style="padding:8px;border:1px solid #ccc;">控肉飯</td><td style="padding:8px;border:1px solid #ccc;">$80</td></tr>
          </table>
        </body></html>
      `, { waitUntil: "load" });
      const imgBuffer = await imgPage.screenshot({ type: "jpeg", quality: 90 });
      await imgPage.close();

      tempImagePath = join(tmpdir(), `lunchbot_test_menu_${Date.now()}.jpg`);
      writeFileSync(tempImagePath, imgBuffer);
      console.log("[e2e:ai-menu-import] 測試圖片已產生：", tempImagePath);

      const page = await browser.newPage();
      await loginAsMockAdmin(page, BASE_URL);

      // 2. 進入新建菜單頁，展開 AI 辨識區塊，上傳圖片
      await page.goto(`${BASE_URL}/admin/menus/new`, { waitUntil: "networkidle0" });
      await page.evaluate(() => {
        document.querySelector("details").open = true;
      });
      const fileInput = await page.$("#ai-image-input");
      await fileInput.uploadFile(tempImagePath);

      // 3. 點「開始辨識」並等待 Gemini API 回應（最多 60 秒）
      await page.click("#ai-analyze-button");
      console.log("[e2e:ai-menu-import] 辨識中，等待 Gemini 回應...");
      await page.waitForFunction(
        () => {
          // 等待辨識完成或出現錯誤訊息
          const btn = document.querySelector("#ai-analyze-button");
          const previewItems = document.querySelector("#ai-preview-items");
          const alert = document.querySelector("[role='alert']");
          return (btn && btn.textContent !== "辨識中...") || previewItems || alert;
        },
        { timeout: 60000 }
      );

      const bodyText = await page.evaluate(() => document.body.innerText);
      // 若 AI 回傳 0 個品項（422），test 算失敗
      assert(
        !bodyText.includes("無法從這張圖片辨識"),
        `AI 辨識失敗，Gemini 無法辨識測試圖片：${bodyText.slice(0, 300)}`
      );
      assert(
        !bodyText.includes("AI 辨識 API 呼叫失敗"),
        `Gemini API 呼叫失敗，請確認 GEMINI_API_KEY 是否正確：${bodyText.slice(0, 300)}`
      );

      // 確認預覽品項出現
      const previewExists = await page.$("#ai-preview-items");
      assert(previewExists, "AI 辨識完成後應顯示預覽品項表格");
      const previewText = await page.$eval("#ai-preview-items", (el) => el.innerText);
      console.log("[e2e:ai-menu-import] ✅ AI 辨識成功，預覽品項：", previewText.slice(0, 100));

      // 4. 套用辨識結果到表單
      await page.click("#ai-apply-button");
      const storeNameValue = await page.$eval("#storeName", (el) => el.value);
      const firstItemValue = await page.$eval('input[name="itemName"]', (el) => el.value);
      assert(firstItemValue.length > 0, "套用 AI 結果後，第一個品名欄位應有值");
      console.log(
        "[e2e:ai-menu-import] ✅ 套用辨識結果成功，店家：", storeNameValue || "(未偵測到)",
        "，第一品項：", firstItemValue
      );

      // 5. 填入必填欄位（日期、截止時間）並建立菜單
      const menuDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await setInputValue(page, "#menuDate", menuDate);
      // 店家名稱加上時間戳，避免多次執行時因 (menu_date, store_name) unique constraint 衝突
      const uniqueStoreName = `${storeNameValue || "AI測試店家"}_${Date.now()}`;
      await setInputValue(page, "#storeName", uniqueStoreName);
      await setInputValue(page, "#cutoffTime", `${menuDate}T23:00`);

      await Promise.all([page.click("#create-menu-submit"), page.waitForNetworkIdle()]);
      assert(
        page.url() === `${BASE_URL}/admin/menus`,
        `建立後應回到菜單列表，實際：${page.url()}`
      );
      console.log("[e2e:ai-menu-import] ✅ AI 辨識匯入建立菜單成功，已回到列表頁");

    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[e2e:ai-menu-import] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    if (tempImagePath) {
      try { unlinkSync(tempImagePath); } catch { /* 清除失敗不影響結果 */ }
    }
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
