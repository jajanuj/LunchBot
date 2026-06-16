// 簡易 session token：用 HMAC-SHA256 簽章的 cookie，不依賴額外套件
// （Node.js 內建 crypto 即可），用於保護 /admin 後台路徑。
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "./credentials";

export const SESSION_COOKIE_NAME = "lb_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 小時

type SessionPayload = AuthUser & { exp: number };

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "環境變數 AUTH_SECRET 未設定，請在 .env.local 加入 AUTH_SECRET（任意隨機字串）"
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createSessionToken(user: AuthUser): {
  token: string;
  maxAge: number;
} {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  return { token: `${payloadB64}.${signature}`, maxAge: SESSION_MAX_AGE_SECONDS };
}

export function verifySessionToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = sign(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    ) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return { email: payload.email, displayName: payload.displayName };
  } catch {
    return null;
  }
}
