import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { hasBearerAuthorization, isCasaAuthApiPath, isCasaDemoPath } from "@/lib/request-auth";

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname.startsWith("/p/")) return true;
  if (pathname.startsWith("/c/")) return true;
  if (pathname === "/casa/entrar" || pathname.startsWith("/casa/entrar/")) return true;
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) return true;
  if (isCasaAuthApiPath(pathname)) return true;
  if (isCasaDemoPath(pathname)) return true;
  return false;
}

function isCasaPath(pathname: string) {
  return pathname === "/casa" || pathname.startsWith("/casa/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie && !hasBearerAuthorization(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (isCasaPath(pathname)) {
      const login = new URL("/casa/entrar", request.url);
      if (pathname !== "/casa/entrar" && !pathname.startsWith("/casa/entrar/")) {
        login.searchParams.set("next", pathname);
      }
      return NextResponse.redirect(login);
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
