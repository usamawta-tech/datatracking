import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const protectedRoutes = ["/dashboard", "/gtm", "/mixpanel"];
const publicRoutes = ["/login", "/signup", "/verify-email", "/"];

async function getSession(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const key = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload as { userId?: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isProtected = protectedRoutes.some((route) => path.startsWith(route));
  const isPublic = publicRoutes.some((route) => path === route);

  const session = await getSession(req);

  if (isProtected && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isPublic && session?.userId && path !== "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
