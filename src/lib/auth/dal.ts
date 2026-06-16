// Data Access Layer：集中放「目前是哪位助理登入」的安全檢查。
// proxy.ts 只做樂觀檢查（重新導向用），實際的資料存取授權一律要經過這裡，
// 依官方文件建議：https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";
import type { AuthUser } from "./credentials";

/**
 * 驗證目前請求是否有合法 session，沒有就導向登入頁。
 * 用 React cache() 包裝，同一次 render pass 內重複呼叫只會檢查一次。
 */
export const verifySession = cache(async (): Promise<AuthUser> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    redirect("/login");
  }

  return user;
});
