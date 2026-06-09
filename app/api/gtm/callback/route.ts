import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/gtm";
import { google } from "googleapis";
import { encrypt, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { prisma } from "@/lib/db";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=no_code", appUrl));

  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/login?error=no_email", appUrl));
    }

    // Find or create the user
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

    // Store GTM tokens
    await prisma.gtmConnection.upsert({
      where: { userId: user.id },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
      create: {
        userId: user.id,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
    });

    // Build session token and attach it directly to the redirect response
    // (cookies() utility doesn't survive NextResponse.redirect in a Route Handler)
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
