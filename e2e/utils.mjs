// E2E 測試共用工具函式
import { execSync } from "node:child_process";

export function waitForServerReady(child, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`等待 dev server 啟動逾時，目前輸出：\n${output}`));
    }, timeoutMs);

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

/**
 * 用 shell:true 啟動的 `next dev` 在 Windows 上會是「cmd.exe -> npx -> node」的
 * process tree，單純呼叫 child.kill() 只會殺掉最外層的 cmd.exe，底層的 next
 * dev server 會變成孤兒程序，永遠佔用 port、吃記憶體。
 * 這裡視平台用 taskkill /T（連子程序一起砍）或一般的 kill。
 */
export function killProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // 程序可能已經結束，忽略錯誤
    }
  } else {
    child.kill();
  }
}

export function assert(condition, message) {
  if (!condition) throw new Error(`斷言失敗：${message}`);
}

/** 共用登入流程：填表單送出，並等待導向 /admin。 */
export async function loginAsMockAdmin(page, baseUrl) {
  const email = process.env.MOCK_ADMIN_EMAIL ?? "admin@lunchbot.local";
  const password = process.env.MOCK_ADMIN_PASSWORD ?? "changeme123";

  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
  await page.type("#email", email);
  await page.type("#password", password);
  await Promise.all([
    page.click("#login-submit"),
    page.waitForNetworkIdle(),
  ]);
  assert(page.url().startsWith(`${baseUrl}/admin`), `登入後應進入 /admin，實際：${page.url()}`);
}
