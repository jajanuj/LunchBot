// LINE Webhook 簽章驗證。
// LINE 每個 Webhook 請求都會帶 `x-line-signature` header，內容是用
// Channel Secret 對「請求原始 body」做 HMAC-SHA256 後 base64 編碼的結果，
// 我們收到後要用同樣的方式重算一次比對，避免處理偽造的請求。
import { validateSignature } from "@line/bot-sdk";

/**
 * @param rawBody 請求的原始 body 字串（務必是還沒被 JSON.parse 過的原始文字，
 *   簽章是對原始 bytes 計算的，重新序列化過的 JSON 字串可能因為空白/順序
 *   不同而驗證失敗）
 * @param signature `x-line-signature` header 的值
 */
export function isValidLineSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    throw new Error(
      "環境變數 LINE_CHANNEL_SECRET 未設定，請在 .env.local 加入（取得方式見 docs/PROGRESS.md）"
    );
  }

  return validateSignature(rawBody, channelSecret, signature);
}
