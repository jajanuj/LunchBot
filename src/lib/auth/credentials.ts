// 助理帳號的「身分驗證」抽象層。
//
// 目前狀態：Supabase 專案尚未建立，先用程式內的假帳號（mock）撐起登入流程，
// 之後接上 Supabase Auth 時，只需要把 findUserByEmail() 換成查詢 Supabase 即可，
// 上層（login API route / middleware）不需要改動。
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthUser = {
  email: string;
  displayName: string;
};

type MockUserRecord = AuthUser & {
  // 格式："<salt(hex)>:<derivedKey(hex)>"，用 scrypt 雜湊，不存明文密碼
  passwordHash: string;
};

function hashPassword(password: string, salt: string): string {
  const derivedKey = scryptSync(password, salt, 64);
  return derivedKey.toString("hex");
}

/** 開發用：產生「salt:hash」字串，方便建立新的 mock 帳號時使用。 */
export function createPasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashPassword(password, salt)}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt);
  const candidateBuf = Buffer.from(candidate, "hex");
  const storedBuf = Buffer.from(hash, "hex");
  if (candidateBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(candidateBuf, storedBuf);
}

// ----------------------------------------------------------------------------
// Mock 帳號名冊（開發階段用，正式上線前需換成 Supabase Auth / employees 後台管理）
// 預設種子帳號可透過環境變數覆寫，方便老闆在自己的 .env.local 設定。
// ----------------------------------------------------------------------------
const seedEmail = process.env.MOCK_ADMIN_EMAIL ?? "admin@lunchbot.local";
const seedPassword = process.env.MOCK_ADMIN_PASSWORD ?? "changeme123";

const mockUsers: MockUserRecord[] = [
  {
    email: seedEmail,
    displayName: "助理（開發測試帳號）",
    passwordHash: createPasswordHash(seedPassword),
  },
];

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthUser | null> {
  const user = mockUsers.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { email: user.email, displayName: user.displayName };
}
