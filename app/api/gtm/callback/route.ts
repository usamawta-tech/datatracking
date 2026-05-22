import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/gtm";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.redirect(new URL("/login", appUrl));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/gtm?error=no_code", appUrl));

  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);

    await prisma.gtmConnection.upsert({
      where: { userId: session.userId },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
      create: {
        userId: session.userId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
    });

    return NextResponse.redirect(new URL("/gtm?connected=1", appUrl));
  } catch (e) {
    console.error("GTM OAuth callback error:", e);
    return NextResponse.redirect(new URL("/gtm?error=auth_failed", appUrl));
  }
}
