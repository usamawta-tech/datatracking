import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

const protectedRoutes = ["/dashboard", "/gtm", "/mixpanel"];
const publicRoutes = ["/login", "/signup", "/verify-email", "/"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isProtected = protectedRoutes.some((route) =>
    path.startsWith(route)
  );

  const isPublic = publicRoutes.some((route) => path === route);

  const token = req.cookies.get("session")?.value;

  let session = null;

  if (token) {
    try {
      session = await decrypt(token);
    } catch {
      session = null;
    }
  }

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

// import { NextRequest, NextResponse } from "next/server";
// import { decrypt } from "@/lib/session";

// const protectedRoutes = ["/dashboard", "/gtm", "/mixpanel"];
// const publicRoutes = ["/login", "/signup", "/verify-email", "/"];

// export default async function middlewar(req: NextRequest) {
//   const path = req.nextUrl.pathname;
//   const isProtected = protectedRoutes.some((r) => path.startsWith(r));
//   const isPublic = publicRoutes.some((r) => path === r);

//   const token = req.cookies.get("session")?.value;
//   const session = await decrypt(token);

//   if (isProtected && !session?.userId) {
//     return NextResponse.redirect(new URL("/login", req.nextUrl));
//   }

//   if (isPublic && session?.userId && path !== "/") {
//     return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
// };
