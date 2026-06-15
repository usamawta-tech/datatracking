import { OAuth2Client } from "google-auth-library";
import { tagmanager } from "@googleapis/tagmanager";
import { prisma } from "@/lib/db";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const REDIRECT_URI = `${appUrl}/api/gtm/callback`;

export function createOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.delete.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
      "https://www.googleapis.com/auth/tagmanager.publish",
      "https://www.googleapis.com/auth/tagmanager.manage.users",
      "https://www.googleapis.com/auth/tagmanager.manage.accounts",
      "email",
      "profile",
    ],
  });
}

export async function getValidAccessToken(conn: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}): Promise<string> {
  if (conn.expiresAt && conn.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return conn.accessToken;
  }
  if (!conn.refreshToken) return conn.accessToken;

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: conn.refreshToken });
  const { credentials } = await client.refreshAccessToken();

  if (credentials.access_token) {
    await prisma.gtmConnection.update({
      where: { userId: conn.userId },
      data: {
        accessToken: credentials.access_token,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });
    return credentials.access_token;
  }
  return conn.accessToken;
}

// Extracts the real error message from a googleapis GaxiosError.
// err.message is always "Request failed with status code XXX" — the actual
// GTM reason lives in err.response.data.error.message.
function gtmErrMsg(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const apiMsg =
      (e.response as Record<string, unknown> | undefined)
        ?.data as Record<string, unknown> | undefined;
    const nested = apiMsg?.error as Record<string, unknown> | undefined;
    if (nested?.message && typeof nested.message === "string") {
      return nested.message.toLowerCase();
    }
    if (e.message && typeof e.message === "string") return e.message.toLowerCase();
  }
  return String(err).toLowerCase();
}

export function getTagManagerClient(accessToken: string, refreshToken?: string | null) {
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return tagmanager({ version: "v2", auth: client });
}

export async function listAccounts(accessToken: string, refreshToken?: string | null) {
  const tagmanager = getTagManagerClient(accessToken, refreshToken);
  const res = await tagmanager.accounts.list();
  return res.data.account || [];
}

export async function listContainers(accountId: string, accessToken: string, refreshToken?: string | null) {
  const tagmanager = getTagManagerClient(accessToken, refreshToken);
  const res = await tagmanager.accounts.containers.list({
    parent: `accounts/${accountId}`,
  });
  return res.data.container || [];
}

export async function listWorkspaces(accountId: string, containerId: string, accessToken: string, refreshToken?: string | null) {
  const tagmanager = getTagManagerClient(accessToken, refreshToken);
  const res = await tagmanager.accounts.containers.workspaces.list({
    parent: `accounts/${accountId}/containers/${containerId}`,
  });
  return res.data.workspace || [];
}

// ─── One-click full Mixpanel activation ───────────────────────────────────────

export async function activateMixpanelTracking(
  accountId: string,
  containerId: string,
  _workspaceId: string,
  mixpanelToken: string,
  accessToken: string,
  refreshToken?: string | null
): Promise<{ tagsCreated: string[] }> {
  const tm = getTagManagerClient(accessToken, refreshToken);
  const freshId = await makeFreshWorkspace(tm, accountId, containerId);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${freshId}`;
  const created: string[] = [];

  // ── 1. Triggers ─────────────────────────────────────────────────────────────
  const [allPagesRes, clickRes, formRes] = await Promise.all([
    tm.accounts.containers.workspaces.triggers.create({
      parent,
      requestBody: { name: "MP - All Pages", type: "pageview" },
    }),
    tm.accounts.containers.workspaces.triggers.create({
      parent,
      requestBody: {
        name: "MP - All Clicks",
        type: "click",
        waitForTags: { type: "BOOLEAN", value: "false" },
        checkValidation: { type: "BOOLEAN", value: "false" },
      },
    }),
    tm.accounts.containers.workspaces.triggers.create({
      parent,
      requestBody: {
        name: "MP - All Forms",
        type: "formSubmit",
        waitForTags: { type: "BOOLEAN", value: "true" },
        checkValidation: { type: "BOOLEAN", value: "false" },
      },
    }),
  ]);

  const allPagesTrigId = allPagesRes.data.triggerId!;
  const clickTrigId    = clickRes.data.triggerId!;
  const formTrigId     = formRes.data.triggerId!;


  // ── 2. Mixpanel Init tag (All Pages, once per page) ─────────────────────────
  // Kept as Custom HTML: loads the Mixpanel SDK async stub, initialises the project,
  // and registers document-level click/form listeners that MP - Button Click and
  // MP - Form Submit depend on. This bootstrap behaviour cannot be expressed as a
  // simple Mixpanel template event call.
  const initHtml = `<script>
/* Mixpanel SDK stub — queues calls until SDK loads */
(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms register register_once unregister identify name_tag set_config reset people.set people.set_once people.increment people.append people.union people.track_charge people.clear_charges people.delete_user".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);b._i.push([e,f,c])};b.__SV=1.1}f&&f.getElementById("_mp_s")||(e=f.createElement("script"),e.id="_mp_s",e.type="text/javascript",e.async=!0,e.src="https://cdn.mixpanel.com/libs/mixpanel-2-latest.min.js",g=f.getElementsByTagName("script")[0],g.parentNode.insertBefore(e,g))})(document,window.mixpanel||[]);
mixpanel.init(${JSON.stringify(mixpanelToken)},{track_pageview:false,persistence:"localStorage",loaded:function(){window._mpReady=true;}});

/* Capture last-clicked element so click tags can read it */
window._mpClick=null;
window._mpForm=null;
document.addEventListener("click",function(e){
  var el=e.target.closest("button,a,[type='submit'],input,select,[role='button']")||e.target;
  window._mpClick={text:(el.innerText||el.value||el.getAttribute("aria-label")||"").trim().slice(0,120),id:el.id||"",tag:el.tagName.toLowerCase(),href:el.href||""};
},true);
document.addEventListener("submit",function(e){
  var f=e.target;window._mpForm={id:f.id||"",action:f.action||""};
},true);
<\/script>`;

  await tm.accounts.containers.workspaces.tags.create({
    parent,
    requestBody: {
      name: "MP - Init",
      type: "html",
      parameter: [{ type: "TEMPLATE", key: "html", value: initHtml }],
      firingTriggerId: [allPagesTrigId],
      tagFiringOption: "ONCE_PER_PAGE",
    },
  });
  created.push("MP - Init");

  // ── 3. Page View tag ─────────────────────────────────────────────────────────
  await tm.accounts.containers.workspaces.tags.create({
    parent,
    requestBody: {
      name: "MP - Page View",
      type: "html",
      parameter: [{ type: "TEMPLATE", key: "html", value: `<script>
(function(){var t=0;(function w(){if(window._mpReady&&window.mixpanel){mixpanel.track("page_view",{page:window.location.pathname,title:document.title,url:window.location.href,referrer:document.referrer});}else if(++t<30){setTimeout(w,100);}})();})();
<\/script>` }],
      firingTriggerId: [allPagesTrigId],
    },
  });
  created.push("MP - Page View");

  // ── 4. Button Click tag ───────────────────────────────────────────────────────
  await tm.accounts.containers.workspaces.tags.create({
    parent,
    requestBody: {
      name: "MP - Button Click",
      type: "html",
      parameter: [{ type: "TEMPLATE", key: "html", value: `<script>
(function(){var t=0;(function w(){if(window._mpReady&&window.mixpanel&&window._mpClick){var c=window._mpClick;var ev=c.text&&/(buy|purchase|checkout|order)/i.test(c.text)?"checkout_started":c.text&&/(sign up|signup|register|join)/i.test(c.text)?"signup":c.text&&/(sign in|login|log in)/i.test(c.text)?"login":"button_click";mixpanel.track(ev,{page:window.location.pathname,button_text:c.text,element_id:c.id,element_tag:c.tag,href:c.href});}else if(++t<30){setTimeout(w,100);}})();})();
<\/script>` }],
      firingTriggerId: [clickTrigId],
    },
  });
  created.push("MP - Button Click");

  // ── 5. Form Submit tag ────────────────────────────────────────────────────────
  await tm.accounts.containers.workspaces.tags.create({
    parent,
    requestBody: {
      name: "MP - Form Submit",
      type: "html",
      parameter: [{ type: "TEMPLATE", key: "html", value: `<script>
(function(){var t=0;(function w(){if(window._mpReady&&window.mixpanel&&window._mpForm){var f=window._mpForm;var ev=/(login|signin)/i.test(f.id+f.action)?"login":/(signup|register|join)/i.test(f.id+f.action)?"signup":"form_submit";mixpanel.track(ev,{page:window.location.pathname,form_id:f.id,form_action:f.action});}else if(++t<30){setTimeout(w,100);}})();})();
<\/script>` }],
      firingTriggerId: [formTrigId],
    },
  });
  created.push("MP - Form Submit");

  // ── 6. Publish workspace ──────────────────────────────────────────────────────
  await publishWorkspace(accountId, containerId, freshId, accessToken, refreshToken);

  return { tagsCreated: created };
}

// ─── Event-based auto-tagging ─────────────────────────────────────────────────

export async function createEventTagInGTM(
  accountId: string,
  containerId: string,
  workspaceId: string,
  eventName: string,
  mixpanelToken: string,
  accessToken: string,
  refreshToken?: string | null
) {
  const tagmanager = getTagManagerClient(accessToken, refreshToken);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;

  // Custom Event trigger — fires when dataLayer.push({ event: eventName }) happens
  const triggerRes = await tagmanager.accounts.containers.workspaces.triggers.create({
    parent,
    requestBody: {
      name: `Auto - ${eventName}`,
      type: "customEvent",
      customEventFilter: [
        {
          type: "EQUALS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{_event}}" },
            { type: "TEMPLATE", key: "arg1", value: eventName },
          ],
        },
      ],
    },
  });

  const triggerId = triggerRes.data.triggerId!;

  const mixpanelTagType = await resolveMixpanelTemplateType(tagmanager, parent, accessToken);

  const tagRes = await tagmanager.accounts.containers.workspaces.tags.create({
    parent,
    requestBody: {
      name: `Auto - ${eventName}`,
      type: mixpanelTagType,
      parameter: [
        { type: "TEMPLATE", key: "token",          value: mixpanelToken },
        { type: "TEMPLATE", key: "type",           value: "track" },
        { type: "TEMPLATE", key: "trackEventName", value: eventName },
      ],
      firingTriggerId: [triggerId],
    },
  });

  return {
    tagId: tagRes.data.tagId ?? null,
    triggerId,
    name: tagRes.data.name ?? `Auto - ${eventName}`,
  };
}

// Returns the Default workspace ID. The Default workspace is permanent — GTM never
// deletes it — so tags deployed here are always visible in the GTM Tags section.
// After create_version + publish, the Default workspace resets to reflect the
// published state, making all deployed tags visible.
async function makeFreshWorkspace(
  tm: ReturnType<typeof getTagManagerClient>,
  accountId: string,
  containerId: string
): Promise<string> {
  const containerParent = `accounts/${accountId}/containers/${containerId}`;

  const list = await tm.accounts.containers.workspaces.list({ parent: containerParent });
  const workspaces = list.data.workspace ?? [];

  // Default workspace is always named "Default" and is the permanent workspace.
  const defaultWs =
    workspaces.find((w) => w.name === "Default") ??
    workspaces.find((w) => w.workspaceId === "1") ??
    workspaces[0];

  if (!defaultWs?.workspaceId) {
    throw new Error("GTM: could not find Default workspace in this container");
  }

  return defaultWs.workspaceId;
}

export async function publishWorkspace(
  accountId: string,
  containerId: string,
  workspaceId: string,
  accessToken: string,
  refreshToken?: string | null
) {
  const tm = getTagManagerClient(accessToken, refreshToken);
  const wsPath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
  const label = `AI Tracker ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

  async function doPublish() {
    const versionRes = await tm.accounts.containers.workspaces.create_version({
      path: wsPath,
      requestBody: { name: label },
    });
    const versionId = versionRes.data.containerVersion?.containerVersionId;
    if (!versionId) throw new Error("GTM: failed to create container version");
    await tm.accounts.containers.versions.publish({
      path: `accounts/${accountId}/containers/${containerId}/versions/${versionId}`,
    });
    return { versionId };
  }

  try {
    return await doPublish();
  } catch (err: unknown) {
    const msg = gtmErrMsg(err);

    if (msg.includes("already") || msg.includes("submitted") || msg.includes("conflict") || msg.includes("fingerprint")) {
      // Workspace has a pending submitted version. Find it and publish it first
      // to clear the submitted state, then retry with our new tags.
      try {
        // Get the latest version header and publish it to clear the submitted state
        const latestRes = await tm.accounts.containers.version_headers.latest({
          parent: `accounts/${accountId}/containers/${containerId}`,
        });
        const versionId = latestRes.data.containerVersionId;
        if (versionId) {
          await tm.accounts.containers.versions.publish({
            path: `accounts/${accountId}/containers/${containerId}/versions/${versionId}`,
          }).catch(() => {/* may already be live */});
        }
      } catch {
        // non-fatal
      }

      // Retry now that submitted state is cleared
      return await doPublish();
    }

    throw err;
  }
}

// ─── Funnel-based tagging (existing) ──────────────────────────────────────────

export type FunnelStep = {
  name: string;
  url: string;
  eventName: string;
  description?: string;
};

// ─── Campaign tag deployment ───────────────────────────────────────────────────

export async function getContainerPublicId(
  accountId: string,
  containerId: string,
  accessToken: string,
  refreshToken?: string | null
): Promise<string> {
  const tm = getTagManagerClient(accessToken, refreshToken);
  const res = await tm.accounts.containers.get({
    path: `accounts/${accountId}/containers/${containerId}`,
  });
  const publicId = res.data.publicId;
  if (!publicId) throw new Error("GTM: container publicId not found");
  return publicId;
}

export type TagPlatform = "google_ads" | "ga4" | "meta" | "mixpanel";

export interface PlatformTagConfig {
  platform: TagPlatform;
  tagId: string;
  eventName: string;
}

// ─── Mixpanel template resolution ─────────────────────────────────────────────

// ─── Gallery template resolver ────────────────────────────────────────────────
// cvt_ tag types use galleryReference.galleryTemplateId (e.g. "TNPH4", "5RM3Q") —
// NOT templateId (sequential int) or fingerprint (version hash).
// galleryTemplateId is assigned once on first sync and is stable across workspaces.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GtmTemplate = any;

async function resolveGalleryTemplateType(
  tm: ReturnType<typeof getTagManagerClient>,
  parent: string,
  galleryOwner: string,
  galleryRepository: string,
  matchFn: (t: GtmTemplate) => boolean,
  accessToken: string
): Promise<string> {
  const extractId = (t: GtmTemplate): string | null =>
    t?.galleryReference?.galleryTemplateId ?? null;

  // 1. Check if template already in workspace
  let templates: GtmTemplate[] = [];
  try {
    const res = await tm.accounts.containers.workspaces.templates.list({ parent });
    templates = res.data.template ?? [];
  } catch (err) {
    throw new Error(`GTM: templates.list failed — ${gtmErrMsg(err)}`);
  }

  const existingId = extractId(templates.find(matchFn));
  if (existingId) return `cvt_${existingId}`;

  // 2. Import via direct HTTP — bypasses googleapis client param-encoding quirks.
  //    Exact URL format confirmed working via Postman.
  const importUrl =
    `https://tagmanager.googleapis.com/tagmanager/v2/${parent}/templates:import_from_gallery` +
    `?galleryOwner=${encodeURIComponent(galleryOwner)}` +
    `&galleryRepository=${encodeURIComponent(galleryRepository)}` +
    `&acknowledgePermissions=true`;

  const importRes = await fetch(importUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!importRes.ok) {
    const errText = await importRes.text().catch(() => "");
    throw new Error(
      `GTM: import_from_gallery ${galleryOwner}/${galleryRepository} failed — ${importRes.status}: ${errText}`
    );
  }

  // 3. Re-list up to 5× with 1 s delay to get the persisted galleryTemplateId
  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000));
    try {
      const res2 = await tm.accounts.containers.workspaces.templates.list({ parent });
      const id = extractId((res2.data.template ?? []).find(matchFn));
      if (id) return `cvt_${id}`;
    } catch { /* retry */ }
  }

  throw new Error(
    `GTM: ${galleryOwner}/${galleryRepository} imported but galleryTemplateId could not be resolved`
  );
}

async function resolveMixpanelTemplateType(
  tm: ReturnType<typeof getTagManagerClient>,
  parent: string,
  accessToken: string
): Promise<string> {
  return resolveGalleryTemplateType(
    tm, parent,
    "mixpanel", "mixpanel-gtm-template",
    (t) => t.galleryReference?.owner?.toLowerCase() === "mixpanel" ||
            t.name?.toLowerCase().includes("mixpanel"),
    accessToken
  );
}

async function resolveMetaTemplateType(
  tm: ReturnType<typeof getTagManagerClient>,
  parent: string,
  accessToken: string
): Promise<string> {
  return resolveGalleryTemplateType(
    tm, parent,
    "facebook", "GoogleTagManager-WebTemplate-For-FacebookPixel",
    (t) => t.galleryReference?.owner?.toLowerCase() === "facebook" ||
            t.name?.toLowerCase().includes("facebook") ||
            t.name?.toLowerCase().includes("pixel"),
    accessToken
  );
}

export async function deployCampaignTags(
  accountId: string,
  containerId: string,
  _workspaceId: string,
  campaignName: string,
  triggerPath: string,
  platformTags: PlatformTagConfig[],
  accessToken: string,
  refreshToken?: string | null
): Promise<{ triggerId: string; tags: Array<{ platform: TagPlatform; gtmTagId: string; name: string }> }> {
  const tm = getTagManagerClient(accessToken, refreshToken);

  // Always use a fresh workspace to avoid "workspace already submitted" errors.
  const freshId = await makeFreshWorkspace(tm, accountId, containerId);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${freshId}`;

  // Create one page view trigger with CONTAINS filter on {{Page Path}}
  const triggerRes = await tm.accounts.containers.workspaces.triggers.create({
    parent,
    requestBody: {
      name: `Campaign - ${campaignName} - Page View`,
      type: "pageview",
      filter: [
        {
          type: "CONTAINS",
          parameter: [
            { type: "TEMPLATE", key: "arg0", value: "{{Page Path}}" },
            { type: "TEMPLATE", key: "arg1", value: triggerPath },
          ],
        },
      ],
    },
  });

  const triggerId = triggerRes.data.triggerId!;
  const createdTags: Array<{ platform: TagPlatform; gtmTagId: string; name: string }> = [];

  for (const pt of platformTags) {
    const tagName = `Campaign - ${campaignName} - ${pt.platform}`;

    // Build the native GTM tag template for each platform.
    // GA4 and Google Ads use GTM's built-in tag types.
    // Meta (Facebook) and Mixpanel use Custom HTML — no native GTM template exists for them.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TagParam = any;
    let tagType = "html";
    let parameters: TagParam[] = [];

    if (pt.platform === "ga4") {
      // Native GTM tag type for GA4 Event. Only essential parameters — empty LIST params
      // (eventParameters, userProperties) cause GTM version validation to fail.
      tagType = "gaawe";
      parameters = [
        { type: "TEMPLATE", key: "measurementIdOverride", value: pt.tagId },
        { type: "TEMPLATE", key: "eventName",             value: pt.eventName },
      ];

    } else if (pt.platform === "google_ads") {
      // Google Ads Conversion Tracking. tagId: "AW-123456789" or "AW-123456789/Label"
      const stripped = pt.tagId.trim().replace(/^AW-/i, "");
      const [convId, convLabel] = stripped.split("/");
      tagType = "awct";
      parameters = [
        { type: "INTEGER",  key: "conversionId",    value: convId },
        { type: "TEMPLATE", key: "conversionLabel", value: convLabel || pt.eventName },
        { type: "TEMPLATE", key: "conversionValue", value: "0" },
        { type: "TEMPLATE", key: "currencyCode",    value: "USD" },
      ];

    } else if (pt.platform === "meta") {
      // Facebook Pixel community template — galleryOwner: facebook
      tagType = await resolveMetaTemplateType(tm, parent, accessToken);
      parameters = [
        { type: "TEMPLATE", key: "pixelId",             value: pt.tagId },
        { type: "BOOLEAN",  key: "enhancedEcommerce",   value: "false" },
        { type: "BOOLEAN",  key: "useGA4Ecommerce",     value: "false" },
        { type: "TEMPLATE", key: "eventName",           value: "standard" },
        { type: "TEMPLATE", key: "standardEventName",   value: pt.eventName },
        { type: "TEMPLATE", key: "consent",             value: "true" },
        { type: "BOOLEAN",  key: "advancedMatching",    value: "false" },
        { type: "BOOLEAN",  key: "disableAutoConfig",   value: "false" },
        { type: "BOOLEAN",  key: "disablePushState",    value: "false" },
      ];

    } else if (pt.platform === "mixpanel") {
      // Mixpanel community template — galleryOwner: mixpanel
      // Parameter keys sourced directly from template.tpl in workspace (templateId 61)
      tagType = await resolveMixpanelTemplateType(tm, parent, accessToken);
      parameters = [
        { type: "TEMPLATE", key: "token",          value: pt.tagId },
        { type: "TEMPLATE", key: "type",           value: "track" },
        { type: "TEMPLATE", key: "trackEventName", value: pt.eventName },
      ];
    }

    const tagRes = await tm.accounts.containers.workspaces.tags.create({
      parent,
      requestBody: {
        name: tagName,
        type: tagType,
        parameter: parameters,
        firingTriggerId: [triggerId],
      },
    });

    createdTags.push({
      platform: pt.platform,
      gtmTagId: tagRes.data.tagId ?? "",
      name: tagRes.data.name ?? tagName,
    });
  }

  await publishWorkspace(accountId, containerId, freshId, accessToken, refreshToken);

  return { triggerId, tags: createdTags };
}

// ─── Funnel-based tagging (existing) ──────────────────────────────────────────

export async function createFunnelTagsInGTM(
  accountId: string,
  containerId: string,
  _workspaceId: string,
  funnelName: string,
  steps: FunnelStep[],
  mixpanelToken: string,
  accessToken: string,
  refreshToken?: string | null
) {
  const tagmanager = getTagManagerClient(accessToken, refreshToken);
  const freshId = await makeFreshWorkspace(tagmanager, accountId, containerId);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${freshId}`;
  const createdTags = [];

  // Resolve Mixpanel template type once — reused for every step
  const mixpanelTagType = await resolveMixpanelTemplateType(tagmanager, parent, accessToken);

  for (const step of steps) {
    const triggerRes = await tagmanager.accounts.containers.workspaces.triggers.create({
      parent,
      requestBody: {
        name: `Trigger - ${funnelName} - ${step.name}`,
        type: "pageview",
        filter: [
          {
            type: "EQUALS",
            parameter: [
              { type: "TEMPLATE", key: "arg0", value: "{{Page Path}}" },
              { type: "TEMPLATE", key: "arg1", value: step.url },
            ],
          },
        ],
      },
    });

    const triggerId = triggerRes.data.triggerId!;

    const tagRes = await tagmanager.accounts.containers.workspaces.tags.create({
      parent,
      requestBody: {
        name: `Tag - ${funnelName} - ${step.name}`,
        type: mixpanelTagType,
        parameter: [
          { type: "TEMPLATE", key: "token",          value: mixpanelToken },
          { type: "TEMPLATE", key: "type",           value: "track" },
          { type: "TEMPLATE", key: "trackEventName", value: step.eventName },
        ],
        firingTriggerId: [triggerId],
      },
    });

    createdTags.push({
      name: tagRes.data.name,
      tagId: tagRes.data.tagId,
      triggerId,
      step: step.name,
      tagType: "mixpanel",
    });
  }

  // Publish the fresh workspace (create_version auto-deletes it after publish)
  await publishWorkspace(accountId, containerId, freshId, accessToken, refreshToken);

  return createdTags;
}
