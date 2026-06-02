import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { trackServerEvent } from "@/lib/mixpanel";
import { createEventTagInGTM, publishWorkspace, getValidAccessToken } from "@/lib/gtm";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Known event types the tracker emits
const TRACKED_EVENT_TYPES = new Set([
  "page_view",
  "button_click",
  "form_submit",
  "signup",
  "login",
  "checkout_started",
  "purchase",
  "scroll_depth",
]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      key,
      event: eventName,
      page,
      page_url,
      page_title,
      referrer,
      distinct_id,
      session_id,
      timestamp,
      button_text,
      button_id,
      form_id,
      form_action,
      scroll_percent,
      href,
    } = body;

    if (!key || !eventName) {
      return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
    }

    const user = await prisma.user.findUnique({
      where: { siteKey: key },
      select: { id: true },
    });

    // Always return 200 to not leak key validity
    if (!user) return NextResponse.json({ ok: true }, { headers: CORS });

    const eventType = String(eventName).slice(0, 50);
    const properties: Record<string, unknown> = {};
    if (distinct_id)    properties.distinct_id    = distinct_id;
    if (session_id)     properties.session_id     = session_id;
    if (button_text)    properties.button_text     = button_text;
    if (button_id)      properties.button_id      = button_id;
    if (form_id)        properties.form_id        = form_id;
    if (form_action)    properties.form_action    = form_action;
    if (scroll_percent) properties.scroll_percent = scroll_percent;
    if (href)           properties.href           = href;
    if (timestamp)      properties.timestamp      = timestamp;

    // 1. Store event in DB
    await prisma.event.create({
      data: {
        userId: user.id,
        type: eventType,
        url: String(page_url || "").slice(0, 2000),
        path: String(page || "").slice(0, 500),
        title: page_title ? String(page_title).slice(0, 300) : null,
        element: Object.keys(properties).length ? JSON.stringify(properties) : null,
        referrer: referrer ? String(referrer).slice(0, 2000) : null,
      },
    });

    // 2. Forward to Mixpanel + auto-create GTM tags — both fire-and-forget
    triggerAutomations(user.id, eventType, {
      distinct_id: distinct_id || "anonymous",
      session_id,
      page: page || "",
      page_title,
      ...properties,
    }).catch((err) => console.error("[automation]", err));

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error("[collect]", err);
    return NextResponse.json({ ok: true }, { headers: CORS });
  }
}

async function triggerAutomations(
  userId: string,
  eventType: string,
  properties: Record<string, unknown>
) {
  const [mpConn, gtmConn] = await Promise.all([
    prisma.mixpanelConnection.findUnique({ where: { userId } }),
    prisma.gtmConnection.findUnique({ where: { userId } }),
  ]);

  // ── Mixpanel: server-side tracking ───────────────────────────────────────
  if (mpConn?.projectToken) {
    await trackServerEvent(mpConn.projectToken, eventType, properties).catch(
      (e) => console.error("[mixpanel track]", e)
    );
  }

  // ── GTM: auto-create tag if this event type has never been tagged ─────────
  if (
    gtmConn?.selectedAccountId &&
    gtmConn?.selectedContainerId &&
    gtmConn?.selectedWorkspaceId &&
    mpConn?.projectToken &&
    TRACKED_EVENT_TYPES.has(eventType)
  ) {
    await autoTagNewEvent(userId, gtmConn, mpConn.projectToken, eventType).catch(
      (e) => console.error("[gtm auto-tag]", e)
    );
  }
}

async function autoTagNewEvent(
  userId: string,
  gtmConn: {
    userId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    selectedAccountId: string | null;
    selectedContainerId: string | null;
    selectedWorkspaceId: string | null;
  },
  mixpanelToken: string,
  eventType: string
) {
  // Idempotency: skip if this event type already has a tag
  const existing = await prisma.generatedTag.findFirst({
    where: { userId, name: `Auto - ${eventType}` },
  });
  if (existing) return;

  const accessToken = await getValidAccessToken({
    userId,
    accessToken: gtmConn.accessToken,
    refreshToken: gtmConn.refreshToken,
    expiresAt: gtmConn.expiresAt,
  });

  const tag = await createEventTagInGTM(
    gtmConn.selectedAccountId!,
    gtmConn.selectedContainerId!,
    gtmConn.selectedWorkspaceId!,
    eventType,
    mixpanelToken,
    accessToken,
    gtmConn.refreshToken
  );

  await prisma.generatedTag.create({
    data: {
      userId,
      gtmTagId: tag.tagId ?? undefined,
      name: `Auto - ${eventType}`,
      tagType: "auto_event",
      triggerName: `Auto - ${eventType}`,
      config: JSON.stringify({ eventType, ...tag }),
      status: "created",
    },
  });

  // Publish the workspace so the new tag goes live immediately
  await publishWorkspace(
    gtmConn.selectedAccountId!,
    gtmConn.selectedContainerId!,
    gtmConn.selectedWorkspaceId!,
    accessToken,
    gtmConn.refreshToken
  );

  await prisma.generatedTag.updateMany({
    where: { userId, name: `Auto - ${eventType}` },
    data: { status: "published" },
  });
}
