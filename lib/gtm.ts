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
  workspaceId: string,
  mixpanelToken: string,
  accessToken: string,
  refreshToken?: string | null
): Promise<{ tagsCreated: string[] }> {
  const tm = getTagManagerClient(accessToken, refreshToken);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
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
(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms register register_once unregister identify name_tag set_config reset people.set people.set_once people.increment people.append people.union people.track_charge people.clear_charges people.delete_user".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);b._i.push([e,f,c])};b.__SV=1.1}f&&f.getElementById("_mp_s")||(e=f.createElement("script"),e.id="_mp_s",e.type="text/javascript",e.async=!0,e.src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js",g=f.getElementsByTagName("script")[0],g.parentNode.insertBefore(e,g))})(document,window.mixpanel||[]);
mixpanel.init(${JSON.stringify(mixpanelToken)},{track_pageview:false,persistence:"localStorage"});

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
if(typeof mixpanel!=="undefined"){
  mixpanel.track("page_view",{page:window.location.pathname,title:document.title,url:window.location.href,referrer:document.referrer});
}
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
if(typeof mixpanel!=="undefined"&&window._mpClick){
  var c=window._mpClick;
  var ev=c.text&&/(buy|purchase|checkout|order)/i.test(c.text)?"checkout_started":c.text&&/(sign up|signup|register|join)/i.test(c.text)?"signup":c.text&&/(sign in|login|log in)/i.test(c.text)?"login":"button_click";
  mixpanel.track(ev,{page:window.location.pathname,button_text:c.text,element_id:c.id,element_tag:c.tag,href:c.href});
}
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
if(typeof mixpanel!=="undefined"&&window._mpForm){
  var f=window._mpForm;
  var ev=/(login|signin)/i.test(f.id+f.action)?"login":/(signup|register|join)/i.test(f.id+f.action)?"signup":"form_submit";
  mixpanel.track(ev,{page:window.location.pathname,form_id:f.id,form_action:f.action});
}
<\/script>` }],
      firingTriggerId: [formTrigId],
      setupTag,
    },
  });
  created.push("MP - Form Submit");

  // ── 6. Publish workspace ──────────────────────────────────────────────────────
  await publishWorkspace(accountId, containerId, workspaceId, accessToken, refreshToken);

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

export async function publishWorkspace(
  accountId: string,
  containerId: string,
  workspaceId: string,
  accessToken: string,
  refreshToken?: string | null
) {
  const tagmanager = getTagManagerClient(accessToken, refreshToken);
  const workspacePath = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;

  // Create a container version from the workspace
  const versionRes = await tagmanager.accounts.containers.workspaces.create_version({
    path: workspacePath,
    requestBody: {
      name: `Auto-published ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    },
  });

  const versionId = versionRes.data.containerVersion?.containerVersionId;
  if (!versionId) throw new Error("GTM: failed to create container version");

  // Publish the version
  await tagmanager.accounts.containers.versions.publish({
    path: `accounts/${accountId}/containers/${containerId}/versions/${versionId}`,
  });

  return { versionId };
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

export async function deployCampaignTags(
  accountId: string,
  containerId: string,
  workspaceId: string,
  campaignName: string,
  triggerPath: string,
  platformTags: PlatformTagConfig[],
  accessToken: string,
  refreshToken?: string | null
): Promise<{ triggerId: string; tags: Array<{ platform: TagPlatform; gtmTagId: string; name: string }> }> {
  const tm = getTagManagerClient(accessToken, refreshToken);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;

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
    let html = "";
    const tagName = `Campaign - ${campaignName} - ${pt.platform}`;

    if (pt.platform === "google_ads") {
      html = `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('event', ${JSON.stringify(pt.eventName)}, {'send_to': ${JSON.stringify(pt.tagId)}});<\/script>`;
    } else if (pt.platform === "ga4") {
      html = `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('event', ${JSON.stringify(pt.eventName)}, {'send_to': ${JSON.stringify(pt.tagId)}});<\/script>`;
    } else if (pt.platform === "meta") {
      html = `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pt.tagId)});
fbq('track', ${JSON.stringify(pt.eventName)});
<\/script>`;
    } else if (pt.platform === "mixpanel") {
      html = `<script>
(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms register register_once unregister identify name_tag set_config reset people.set people.set_once people.increment people.append people.union people.track_charge people.clear_charges people.delete_user".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);b._i.push([e,f,c])};b.__SV=1.1}f&&f.getElementById("_mp_s")||(e=f.createElement("script"),e.id="_mp_s",e.type="text/javascript",e.async=!0,e.src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js",g=f.getElementsByTagName("script")[0],g.parentNode.insertBefore(e,g))})(document,window.mixpanel||[]);
mixpanel.init(${JSON.stringify(pt.tagId)}, {persistence: "localStorage"});
mixpanel.track(${JSON.stringify(pt.eventName)});
<\/script>`;
    }

    const tagRes = await tm.accounts.containers.workspaces.tags.create({
      parent,
      requestBody: {
        name: tagName,
        type: "html",
        parameter: [{ type: "TEMPLATE", key: "html", value: html }],
        firingTriggerId: [triggerId],
      },
    });

    createdTags.push({
      platform: pt.platform,
      gtmTagId: tagRes.data.tagId ?? "",
      name: tagRes.data.name ?? tagName,
    });
  }

  // Publish the workspace
  await publishWorkspace(accountId, containerId, workspaceId, accessToken, refreshToken);

  return { triggerId, tags: createdTags };
}

// ─── Funnel-based tagging (existing) ──────────────────────────────────────────

export async function createFunnelTagsInGTM(
  accountId: string,
  containerId: string,
  workspaceId: string,
  funnelName: string,
  steps: FunnelStep[],
  mixpanelToken: string,
  accessToken: string,
  refreshToken?: string | null
) {
  const tagmanager = getTagManagerClient(accessToken, refreshToken);
  const parent = `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
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
  if(typeof mixpanel==='undefined') return;
  mixpanel.track(${JSON.stringify(step.eventName)},{
    funnel:${JSON.stringify(funnelName)},
    step:${JSON.stringify(step.name)},
    url:window.location.href
  });
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

  return createdTags;
}
