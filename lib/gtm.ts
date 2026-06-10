import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
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
  return google.tagmanager({ version: "v2", auth: client });
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

  const initRes = await tm.accounts.containers.workspaces.tags.create({
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

  const setupTag = [{ tagName: "MP - Init", stopOnSetupFailure: false }];

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
      setupTag,
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
      setupTag,
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
      setupTag,
    },
  });
  created.push("MP - Form Submit");

  // ── 6. Publish workspace ──────────────────────────────────────────────────────
  await publishWorkspace(accountId, containerId, freshId, accessToken, refreshToken);

  void initRes; // suppress unused warning
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

  // Custom HTML tag — reads event props from dataLayer and sends to Mixpanel
  const tagHtml = `<script>
(function(){
  if(typeof mixpanel==='undefined'){return;}
  var dl=window.dataLayer||[];
  var ev={};
  for(var i=dl.length-1;i>=0;i--){
    if(dl[i]&&dl[i].event===${JSON.stringify(eventName)}){ev=dl[i];break;}
  }
  mixpanel.track(${JSON.stringify(eventName)},{
    distinct_id:ev.distinct_id||'anonymous',
    page:ev.page||window.location.pathname,
    page_title:ev.page_title||document.title,
    session_id:ev.session_id,
    button_text:ev.button_text,
    form_id:ev.form_id,
    scroll_percent:ev.scroll_percent,
    href:ev.href,
    timestamp:ev.timestamp||Date.now()
  });
})();
</script>`;

  const tagRes = await tagmanager.accounts.containers.workspaces.tags.create({
    parent,
    requestBody: {
      name: `Auto - ${eventName}`,
      type: "html",
      parameter: [{ type: "TEMPLATE", key: "html", value: tagHtml }],
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

// Finds the Mixpanel GTM gallery template in the workspace, importing it if missing.
// Returns the templateId (used as cvt_{templateId} tag type) or null on failure.
async function getOrImportMixpanelTemplate(
  tm: ReturnType<typeof getTagManagerClient>,
  parent: string
): Promise<string | null> {
  try {
    // Check if the template is already in this workspace
    const listRes = await tm.accounts.containers.workspaces.templates.list({ parent });
    const existing = (listRes.data.template ?? []).find(
      (t) =>
        t.galleryReference?.owner?.toLowerCase() === "mixpanel" ||
        t.galleryReference?.repository?.toLowerCase().includes("mixpanel") ||
        t.name?.toLowerCase().includes("mixpanel")
    );
    if (existing?.templateId) return existing.templateId;

    // Not found — import from the GTM Community Gallery
    const importRes = await tm.accounts.containers.workspaces.templates.create({
      parent,
      requestBody: {
        galleryReference: {
          host:       "tagmanager.google.com",
          owner:      "mixpanel",
          repository: "mixpanel-for-gtm",
          isModified: false,
        },
      },
    });
    return importRes.data.templateId ?? null;
  } catch {
    return null;
  }
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
      // Native GTM template: Google Analytics GA4 Event (type: gaawe)
      tagType = "gaawe";
      parameters = [
        { type: "TEMPLATE", key: "measurementId", value: pt.tagId },   // G-XXXXXXXXXX
        { type: "TEMPLATE", key: "eventName",     value: pt.eventName },
        { type: "BOOLEAN",  key: "sendEcommerceData",     value: "false" },
        { type: "TEMPLATE", key: "getEcommerceDataFrom",  value: "dataLayer" },
        { type: "LIST",     key: "eventParameters",       list: [] },
        { type: "LIST",     key: "userProperties",        list: [] },
      ];

    } else if (pt.platform === "google_ads") {
      // Native GTM template: Google Ads Conversion Tracking (type: adwords_conversion)
      // tagId format expected: "AW-123456789" or "AW-123456789/ConvLabel"
      const stripped = pt.tagId.replace(/^AW-/i, "");
      const [convId, convLabel] = stripped.split("/");
      tagType = "adwords_conversion";
      parameters = [
        { type: "TEMPLATE", key: "conversionId",    value: convId },
        { type: "TEMPLATE", key: "conversionLabel", value: convLabel || pt.eventName },
        { type: "TEMPLATE", key: "conversionValue", value: "0" },
        { type: "TEMPLATE", key: "currencyCode",    value: "USD" },
        { type: "BOOLEAN",  key: "remarketing_only", value: "false" },
      ];

    } else if (pt.platform === "meta") {
      // Custom HTML — Meta Pixel has no native GTM template available via the API
      const html = `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init',${JSON.stringify(pt.tagId)});
fbq('track',${JSON.stringify(pt.eventName)});
<\/script>`;
      parameters = [{ type: "TEMPLATE", key: "html", value: html }];

    } else if (pt.platform === "mixpanel") {
      // Use the official Mixpanel GTM gallery template (owner: mixpanel, repo: mixpanel-for-gtm).
      // Import it into the workspace if not already present, then use cvt_{templateId} as the tag type.
      const mpTemplateId = await getOrImportMixpanelTemplate(tm, parent);

      if (mpTemplateId) {
        tagType = `cvt_${mpTemplateId}`;
        parameters = [
          { type: "TEMPLATE", key: "projectToken",    value: pt.tagId },
          { type: "TEMPLATE", key: "trackEventName",  value: pt.eventName },
          { type: "BOOLEAN",  key: "trackPageView",   value: "false" },
        ];
      } else {
        // Gallery import failed — fall back to Custom HTML with direct HTTP API
        const html = `<script>
(function(){try{
  var t=${JSON.stringify(pt.tagId)},ev=${JSON.stringify(pt.eventName)},did;
  try{var s=JSON.parse(localStorage.getItem('mp_'+t+'_mixpanel')||'{}');did=s.distinct_id||s.$device_id;}catch(e){}
  if(!did){did='a'+Date.now().toString(36)+Math.random().toString(36).slice(2);try{localStorage.setItem('mp_'+t+'_mixpanel',JSON.stringify({distinct_id:did,$device_id:did}));}catch(e){}}
  var p={token:t,distinct_id:did,time:Math.floor(Date.now()/1000),$current_url:location.href,$pathname:location.pathname,$referrer:document.referrer||''};
  var b='data='+encodeURIComponent(btoa(JSON.stringify([{event:ev,properties:p}])))+'&ip=1&verbose=1';
  if(navigator.sendBeacon){navigator.sendBeacon('https://api.mixpanel.com/track',new Blob([b],{type:'application/x-www-form-urlencoded'}));}
  else{var x=new XMLHttpRequest();x.open('POST','https://api.mixpanel.com/track',true);x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.send(b);}
}catch(e){}})();
<\/script>`;
        parameters = [{ type: "TEMPLATE", key: "html", value: html }];
      }
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

    const tagBody = `<script>
(function(){
  try{
    var token=${JSON.stringify(mixpanelToken)};
    var ev=${JSON.stringify(step.eventName)};
    var did;
    try{var s=JSON.parse(localStorage.getItem('mp_'+token+'_mixpanel')||'{}');did=s.distinct_id||s.$device_id;}catch(e){}
    if(!did){did='a'+Date.now().toString(36)+Math.random().toString(36).slice(2);try{localStorage.setItem('mp_'+token+'_mixpanel',JSON.stringify({distinct_id:did,$device_id:did}));}catch(e){}}
    var props={token:token,distinct_id:did,time:Math.floor(Date.now()/1000),funnel:${JSON.stringify(funnelName)},step:${JSON.stringify(step.name)},$current_url:window.location.href,$pathname:window.location.pathname};
    var body='data='+encodeURIComponent(btoa(JSON.stringify([{event:ev,properties:props}])))+'&ip=1&verbose=1';
    if(navigator.sendBeacon){navigator.sendBeacon('https://api.mixpanel.com/track',new Blob([body],{type:'application/x-www-form-urlencoded'}));}
    else{var x=new XMLHttpRequest();x.open('POST','https://api.mixpanel.com/track',true);x.setRequestHeader('Content-Type','application/x-www-form-urlencoded');x.send(body);}
  }catch(e){}
})();
</script>`;

    const tagRes = await tagmanager.accounts.containers.workspaces.tags.create({
      parent,
      requestBody: {
        name: `Tag - ${funnelName} - ${step.name}`,
        type: "html",
        parameter: [{ type: "TEMPLATE", key: "html", value: tagBody }],
        firingTriggerId: [triggerId],
      },
    });

    createdTags.push({
      name: tagRes.data.name,
      tagId: tagRes.data.tagId,
      triggerId,
      step: step.name,
    });
  }

  // Publish the fresh workspace (create_version auto-deletes it after publish)
  await publishWorkspace(accountId, containerId, freshId, accessToken, refreshToken);

  return createdTags;
}
