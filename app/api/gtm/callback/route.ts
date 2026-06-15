import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gtm";
import { encrypt, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { prisma } from "@/lib/db";

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=no_code", appUrl));

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Fetch user info via native fetch — no google-auth-library needed
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userinfoRes.json() as { email?: string; name?: string };

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/login?error=no_email", appUrl));
    }

    let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name ?? googleUser.email,
          emailVerified: new Date(),
        },
      });
    } else if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
      user = { ...user, emailVerified: new Date() };
    }

    await prisma.gtmConnection.upsert({
      where: { userId: user.id },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
      create: {
        userId: user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
    });

    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);
    const sessionToken = await encrypt({ userId: user.id, email: user.email, expiresAt });

    const response = NextResponse.redirect(new URL("/gtm?connected=1", appUrl));
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (e) {
    console.error("GTM OAuth callback error:", e);
    const msg = encodeURIComponent(e instanceof Error ? e.message : String(e));
    return NextResponse.redirect(new URL(`/login?error=${msg}`, appUrl));
  }
}
