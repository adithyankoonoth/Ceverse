import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { safeRedirectPath } from "@/lib/utils";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();

  const { supabaseResponse, user } = await updateSession(request);
  supabaseResponse.headers.set("x-request-id", requestId);

  if (isProtected(pathname) && !user) {
    const signIn = new URL("/sign-in", request.url);
    const next = safeRedirectPath(pathname, "/dashboard");
    if (pathname.startsWith("/") && !pathname.startsWith("//")) {
      signIn.searchParams.set("next", next);
    }
    const redirect = NextResponse.redirect(signIn);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value);
    });
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  if (AUTH_PAGES.includes(pathname) && user) {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value);
    });
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif|woff2?)$).*)",
  ],
};
