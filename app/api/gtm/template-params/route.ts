import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getValidAccessToken, getTagManagerClient } from "@/lib/gtm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.gtmConnection.findUnique({ where: { userId: session.userId } });
  if (!conn?.selectedAccountId || !conn?.selectedContainerId || !conn?.selectedWorkspaceId) {
    return NextResponse.json({ error: "GTM not configured" }, { status: 400 });
  }

  const accessToken = await getValidAccessToken({
    userId: session.userId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken ?? null,
    expiresAt: conn.expiresAt ?? null,
  });

  const tm = getTagManagerClient(accessToken, conn.refreshToken);
  const parent = `accounts/${conn.selectedAccountId}/containers/${conn.selectedContainerId}/workspaces/${conn.selectedWorkspaceId}`;

  const listRes = await tm.accounts.containers.workspaces.templates.list({ parent });
  const templates = (listRes.data.template ?? []).map((t) => ({
    name:              t.name,
    templateId:        t.templateId,
    galleryTemplateId: (t.galleryReference as Record<string, unknown>)?.galleryTemplateId,
    galleryOwner:      t.galleryReference?.owner,
    galleryRepo:       t.galleryReference?.repository,
    // Parse parameter keys from templateData
    parameterKeys: (() => {
      try {
        const tplData = (t as Record<string, unknown>).templateData as string ?? "";
        const section = tplData.match(/___TEMPLATE_PARAMETERS___([\s\S]*?)___/)?.[1] ?? "";
        const names = [...section.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
        return names.length ? names : "see templateData";
      } catch { return "parse error"; }
    })(),
  }));

  return NextResponse.json({ templates });
}
