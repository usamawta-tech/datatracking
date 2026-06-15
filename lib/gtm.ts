import { tagmanager } from "@googleapis/tagmanager";
import { prisma } from "@/lib/db";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function getAppUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getRedirectUri() {
  return `${getAppUrl()}/api/gtm/callback`;
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    response_type: "code",
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
    ].join(" "),
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error_description || data.error || "Token exchange failed");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
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

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  if (data.access_token) {
    await prisma.gtmConnection.update({
      where: { userId: conn.userId },
      data: {
        accessToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      },
    });
    return data.access_token;
  }
  return conn.accessToken;
}

// Extracts the real error message from a googleapis GaxiosError.
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

// Minimal auth adapter — avoids google-auth-library's Node http module
function makeAuth(accessToken: string) {
  return {
    async getRequestHeaders() {
      return { Authorization: `Bearer ${accessToken}` };
    },
  };
}

export function getTagManagerClient(accessToken: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tagmanager({ version: "v2", auth: makeAuth(accessToken) as any });
}

export async function listAccounts(accessToken: string) {
  const tm = getTagManagerClient(accessToken);
  const res = await tm.accounts.list();
  return res.data.account || [];
}

export async function listContainers(accountId: string, accessToken: string) {
  const tm = getTagManagerClient(accessToken);
  const res = await tm.accounts.containers.list({
    parent: `accounts/${accountId}`,
  });
  return res.data.container || [];
}

export async function listWorkspaces(accountId: string, containerId: string, accessToken: string) {
  const tm = getTagManagerClient(accessToken);
  const res = await tm.accounts.containers.workspaces.list({
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
  const tm = getTagManagerClient(accessToken);
  const freshId = await makeFreshWorkspace(tm, accountId, containerId);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${freshId}`;
  const created: string[] = [];

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

  await publishWorkspace(accountId, containerId, freshId, accessToken);

  return { tagsCreated: created };
}

export async function createEventTagInGTM(
  accountId: string,
  containerId: string,
  workspaceId: string,
  eventName: string,
  mixpanelToken: string,
  accessToken: string,
  refreshToken?: string | null
) {
  const tagmanagerClient = getTagManagerClient(accessToken);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;

  const triggerRes = await tagmanagerClient.accounts.containers.workspaces.triggers.create({
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
  const mixpanelTagType = await resolveMixpanelTemplateType(tagmanagerClient, parent, accessToken);

  const tagRes = await tagmanagerClient.accounts.containers.workspaces.tags.create({
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

async function makeFreshWorkspace(
  tm: ReturnType<typeof getTagManagerClient>,
  accountId: string,
  containerId: string
): Promise<string> {
  const containerParent = `accounts/${accountId}/containers/${containerId}`;
  const list = await tm.accounts.containers.workspaces.list({ parent: containerParent });
  const workspaces = list.data.workspace ?? [];

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
  const tm = getTagManagerClient(accessToken);
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
      try {
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
      return await doPublish();
    }
    throw err;
  }
}

export type FunnelStep = {
  name: string;
  url: string;
  eventName: string;
  description?: string;
};

export async function getContainerPublicId(
  accountId: string,
  containerId: string,
  accessToken: string,
  refreshToken?: string | null
): Promise<string> {
  const tm = getTagManagerClient(accessToken);
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

  let templates: GtmTemplate[] = [];
  try {
    const res = await tm.accounts.containers.workspaces.templates.list({ parent });
    templates = res.data.template ?? [];
  } catch (err) {
    throw new Error(`GTM: templates.list failed — ${gtmErrMsg(err)}`);
  }

  const existingId = extractId(templates.find(matchFn));
  if (existingId) return `cvt_${existingId}`;

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
  const tm = getTagManagerClient(accessToken);
  const freshId = await makeFreshWorkspace(tm, accountId, containerId);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${freshId}`;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type TagParam = any;
    let tagType = "html";
    let parameters: TagParam[] = [];

    if (pt.platform === "ga4") {
      tagType = "gaawe";
      parameters = [
        { type: "TEMPLATE", key: "measurementIdOverride", value: pt.tagId },
        { type: "TEMPLATE", key: "eventName",             value: pt.eventName },
      ];
    } else if (pt.platform === "google_ads") {
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

  await publishWorkspace(accountId, containerId, freshId, accessToken);
  return { triggerId, tags: createdTags };
}

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
  const tagmanagerClient = getTagManagerClient(accessToken);
  const freshId = await makeFreshWorkspace(tagmanagerClient, accountId, containerId);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${freshId}`;
  const createdTags = [];

  const mixpanelTagType = await resolveMixpanelTemplateType(tagmanagerClient, parent, accessToken);

  for (const step of steps) {
    const triggerRes = await tagmanagerClient.accounts.containers.workspaces.triggers.create({
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

    const tagRes = await tagmanagerClient.accounts.containers.workspaces.tags.create({
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

  await publishWorkspace(accountId, containerId, freshId, accessToken);
  return createdTags;
}
