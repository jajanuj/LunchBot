// E2E 測試：LINE Webhook 簽章驗證
// 用法：npm run test:e2e:line-webhook
//
// 這是個伺服器對伺服器的端點（LINE 平台 -> 我們的 API），不是給人在瀏覽器
// 點的頁面，所以不是用 Puppeteer 模擬使用者操作，而是直接發送 HTTP
// request 模擬 LINE 平台會送過來的請求（這就是這個端點唯一的「使用者」）。
//
// 涵蓋情境：
//   1. 正確簽章 + 空事件陣列 -> 200
//   2. 正確簽章 + 一個訊息事件 -> 200，且 server log 印出該事件
//   3. 正確簽章 + 一個群組事件 -> 200，且 server log 印出偵測到的 groupId
//   4. 簽章錯誤 -> 401
//   5. 沒帶簽章 header -> 401
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { waitForServerReady, killProcessTree, assert } from "./utils.mjs";

const PORT = 3110;
const BASE_URL = `http://localhost:${PORT}`;
const WEBHOOK_URL = `${BASE_URL}/api/line/webhook`;

const channelSecret = process.env.LINE_CHANNEL_SECRET;
if (!channelSecret) {
  console.error(
    "[e2e:line-webhook] ❌ 找不到環境變數 LINE_CHANNEL_SECRET。\n" +
      "請用「node --env-file=.env.local e2e/line-webhook.test.mjs」執行（npm script 已內建這個 flag）。"
  );
  process.exit(1);
}

function sign(rawBody) {
  return createHmac("sha256", channelSecret).update(rawBody).digest("base64");
}

async function postWebhook(payload, { signatureOverride, omitSignature } = {}) {
  const rawBody = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };
  if (!omitSignature) {
    headers["x-line-signature"] = signatureOverride ?? sign(rawBody);
  }
  const response = await fetch(WEBHOOK_URL, { method: "POST", body: rawBody, headers });
  return response;
}

async function main() {
  console.log(`[e2e:line-webhook] 啟動 Next.js dev server（port ${PORT}）...`);
  const server = spawn(`npx next dev -p ${PORT}`, { shell: true, cwd: process.cwd() });

  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d.toString()));
  server.stderr.on("data", (d) => (serverLog += d.toString()));

  let exitCode = 0;
  try {
    await waitForServerReady(server);
    console.log("[e2e:line-webhook] dev server 已就緒，開始測試...");

    // 1. 正確簽章 + 空事件陣列
    const res1 = await postWebhook({ destination: "Uxxxxxxxx", events: [] });
    assert(res1.status === 200, `空事件陣列應回 200，實際：${res1.status}`);
    console.log("[e2e:line-webhook] ✅ 正確簽章 + 空事件陣列 -> 200");

    // 2. 正確簽章 + 一個訊息事件
    const messageEvent = {
      type: "message",
      replyToken: "fake-reply-token",
      source: { type: "user", userId: "Uabc123" },
      message: { type: "text", id: "1", text: "hello" },
    };
    const res2 = await postWebhook({ destination: "Uxxxxxxxx", events: [messageEvent] });
    assert(res2.status === 200, `訊息事件應回 200，實際：${res2.status}`);
    assert(serverLog.includes("hello"), "server log 應該印出收到的訊息事件內容");
    console.log("[e2e:line-webhook] ✅ 訊息事件正確處理並記錄 log");

    // 3. 正確簽章 + 一個群組事件 -> 應偵測並記錄 groupId
    const fakeGroupId = "Cfakegroupid1234567890";
    const groupEvent = {
      type: "message",
      replyToken: "fake-reply-token-2",
      source: { type: "group", groupId: fakeGroupId, userId: "Uabc123" },
      message: { type: "text", id: "2", text: "在群組裡說話" },
    };
    const res3 = await postWebhook({ destination: "Uxxxxxxxx", events: [groupEvent] });
    assert(res3.status === 200, `群組事件應回 200，實際：${res3.status}`);
    assert(
      serverLog.includes(fakeGroupId) && serverLog.includes("偵測到群組事件"),
      "server log 應該偵測並印出群組事件的 groupId"
    );
    console.log("[e2e:line-webhook] ✅ 群組事件正確偵測並記錄 groupId");

    // 4. 簽章錯誤
    const res4 = await postWebhook(
      { destination: "Uxxxxxxxx", events: [] },
      { signatureOverride: "this-is-not-a-valid-signature==" }
    );
    assert(res4.status === 401, `錯誤簽章應回 401，實際：${res4.status}`);
    console.log("[e2e:line-webhook] ✅ 錯誤簽章正確被拒絕（401）");

    // 5. 沒帶簽章 header
    const res5 = await postWebhook({ destination: "Uxxxxxxxx", events: [] }, { omitSignature: true });
    assert(res5.status === 401, `沒帶簽章應回 401，實際：${res5.status}`);
    console.log("[e2e:line-webhook] ✅ 沒帶簽章 header 正確被拒絕（401）");
  } catch (err) {
    console.error("[e2e:line-webhook] ❌ 測試失敗：", err.message);
    exitCode = 1;
  } finally {
    killProcessTree(server);
  }

  process.exit(exitCode);
}

main();
