// Next.js 16 將原本的 middleware 改名為 proxy（功能相同）。
// 這裡做「樂觀檢查」（optimistic check）：只看 cookie 是否存在合法 session，
// 用來做重新導向，避免未登入直接看到 /admin 的畫面。
//
// 真正的安全檢查（資料存取授權）仍須在每個 page / route handler 內呼叫
// src/lib/auth/dal.ts 的 verifySession()，proxy 不能是唯一的防線。
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const ADMIN_PATH_PREFIX = "/admin";
const LOGIN_PATH = "/login";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith(ADMIN_PATH_PREFIX);
  const isLoginRoute = pathname === LOGIN_PATH;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (isAdminRoute && !session) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && session) {
    return NextResponse.redirect(new URL(ADMIN_PATH_PREFIX, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
