// LINE Messaging API 的伺服器端 client（StockBot channel）。
// 只能在伺服器端使用（API Route / Server Action），絕對不可以把
// LINE_CHANNEL_ACCESS_TOKEN 暴露給前端。
import { messagingApi } from "@line/bot-sdk";

let cachedClient: messagingApi.MessagingApiClient | null = null;

/** 延遲建立 client，避免在沒有設定環境變數時（例如 build 階段）就直接噴錯。 */
export function getLineMessagingClient(): messagingApi.MessagingApiClient {
  if (cachedClient) return cachedClient;

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    throw new Error(
      "環境變數 LINE_CHANNEL_ACCESS_TOKEN 未設定，請在 .env.local 加入（取得方式見 docs/PROGRESS.md）"
    );
  }

  cachedClient = new messagingApi.MessagingApiClient({ channelAccessToken });
  return cachedClient;
}
