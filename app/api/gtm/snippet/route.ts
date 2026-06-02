import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getValidAccessToken, getContainerPublicId } from "@/lib/gtm";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn) return NextResponse.json({ error: "GTM not connected" }, { status: 400 });
  if (!conn.selectedAccountId || !conn.selectedContainerId) {
    return NextResponse.json({ error: "GTM account and container not selected" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken({
      userId: session.userId,
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken ?? null,
      expiresAt: conn.expiresAt ?? null,
    });

    const publicId = await getContainerPublicId(
      conn.selectedAccountId,
      conn.selectedContainerId,
      accessToken,
      conn.refreshToken
    );

    const headSnippet =
      `<!-- Google Tag Manager -->\n` +
      `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':` +
      `new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],` +
      `j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=` +
      `'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);` +
      `})(window,document,'script','dataLayer','${publicId}');</script>\n` +
      `<!-- End Google Tag Manager -->`;

    const bodySnippet =
      `<!-- Google Tag Manager (noscript) -->\n` +
      `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${publicId}"` +
      ` height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n` +
      `<!-- End Google Tag Manager (noscript) -->`;

    return NextResponse.json({ publicId, headSnippet, bodySnippet });
  } catch (e) {
    console.error("[gtm/snippet]", e);
    const msg = e instanceof Error ? e.message : "Failed to fetch GTM snippet";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
