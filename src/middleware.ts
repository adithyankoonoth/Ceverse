import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: cheap session-cookie gate for app surfaces plus a
 * request-id for audit correlation. Real authorization always happens
 * server-side (services + route handlers) — this only prevents
 * unauthenticated users from loading protected shells and handles
 * open-redirect-safe return URLs.
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/marketplace",
  "/deals",
  "/proposals",
  "/messages",
  "/contracts",
  "/payments",
  "/settings",
  "/notifications",
  "/admin",
];

const AUTH_PAGES = ["/sign-in", "/sign-up"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ??
    request.cookies.get("better-auth.session_token");

  // Correlation id for audit logs / tracing, propagated to the server.
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (isProtected(pathname) && !sessionCookie) {
    const signIn = new URL("/sign-in", request.url);
    // Only ever redirect back to same-origin relative paths.
    if (pathname.startsWith("/") && !pathname.startsWith("//")) {
      signIn.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(signIn);
  }

  if (AUTH_PAGES.includes(pathname) && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|woff2?)$).*)",
  ],
};
