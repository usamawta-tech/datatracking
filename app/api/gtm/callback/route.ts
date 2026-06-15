import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/gtm";
import { encrypt, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { prisma } from "@/lib/db";

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(req: NextRequest) {
  const step = { current: "init" };
  const start = Date.now();

  const log = (msg: string, data?: unknown) => {
    const elapsed = Date.now() - start;
    console.log(`[gtm/callback] [${elapsed}ms] [${step.current}] ${msg}`, data ?? "");
  };

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  log("request received", { hasCode: !!code, error, appUrl });

  if (error) {
    log("Google returned an error", { error });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, appUrl));
  }

  if (!code) {
    log("no code in query params");
    return NextResponse.redirect(new URL("/login?error=no_code", appUrl));
  }

  try {
    // ── 1. Exchange code for tokens ──────────────────────────────────────────
    step.current = "token_exchange";
    log("exchanging code for tokens");

    let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
    try {
      tokens = await exchangeCodeForTokens(code);
      log("tokens received", {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      });
    } catch (e) {
      log("token exchange failed", { error: String(e) });
      throw e;
    }

    // ── 2. Fetch user info ────────────────────────────────────────────────────
    step.current = "userinfo";
    log("fetching user info from Google");

    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    log("userinfo response", { status: userinfoRes.status, ok: userinfoRes.ok });

    if (!userinfoRes.ok) {
      const body = await userinfoRes.text();
      log("userinfo request failed", { status: userinfoRes.status, body });
      throw new Error(`Userinfo request failed: ${userinfoRes.status} ${body}`);
    }

    const googleUser = await userinfoRes.json() as { email?: string; name?: string };
    log("user info received", { email: googleUser.email, name: googleUser.name });

    if (!googleUser.email) {
      log("no email in user info");
      return NextResponse.redirect(new URL("/login?error=no_email", appUrl));
    }

    // ── 3. Find or create user ────────────────────────────────────────────────
    step.current = "db_user";
    log("looking up user in DB", { email: googleUser.email });

    let user = await prisma.user.findUnique({ where: { email: googleUser.email } });
    log("DB lookup result", { found: !!user, emailVerified: user?.emailVerified });

    if (!user) {
      log("creating new user");
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name ?? googleUser.email,
          emailVerified: new Date(),
        },
      });
      log("user created", { id: user.id });
    } else if (!user.emailVerified) {
      log("marking existing user email as verified");
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
      user = { ...user, emailVerified: new Date() };
    }

    // ── 4. Store GTM tokens ───────────────────────────────────────────────────
    step.current = "db_gtm_tokens";
    log("upserting GTM connection", { userId: user.id });

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
    log("GTM connection saved");

    // ── 5. Create session ─────────────────────────────────────────────────────
    step.current = "session";
    log("creating session token");

    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);
    const sessionToken = await encrypt({ userId: user.id, email: user.email, expiresAt });
    log("session token created");

    // ── 6. Redirect ───────────────────────────────────────────────────────────
    step.current = "redirect";
    const redirectUrl = new URL("/gtm?connected=1", appUrl);
    log("redirecting", { to: redirectUrl.toString() });

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      sameSite: "lax",
      path: "/",
    });

    log("done", { totalMs: Date.now() - start });
    return response;

  } catch (e) {
    console.error(`[gtm/callback] FAILED at step="${step.current}" after ${Date.now() - start}ms`, e);
    const msg = encodeURIComponent(e instanceof Error ? e.message : String(e));
    return NextResponse.redirect(new URL(`/login?error=${msg}`, appUrl));
  }
}
