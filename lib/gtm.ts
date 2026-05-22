import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

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
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.manage.accounts",
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "email",
      "profile",
    ],
  });
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

export type FunnelStep = {
  name: string;
  url: string;
  eventName: string;
  description?: string;
};

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
    // Create a Page View trigger for this step's URL
    const triggerRes = await tagmanager.accounts.containers.workspaces.triggers.create({
      parent,
      requestBody: {
        name: `Trigger - ${funnelName} - ${step.name}`,
        type: "PAGE_VIEW",
        filter: [
          {
            type: "CONTAINS",
            parameter: [
              { type: "TEMPLATE", key: "arg0", value: "{{Page URL}}" },
              { type: "TEMPLATE", key: "arg1", value: step.url },
            ],
          },
        ],
      },
    });

    const triggerId = triggerRes.data.triggerId!;

    // Create a Custom HTML tag that fires the Mixpanel event
    const tagBody = `<script>
(function(){
  if(typeof mixpanel === 'undefined') return;
  mixpanel.track('${step.eventName}', {
    funnel: '${funnelName}',
    step: '${step.name}',
    url: window.location.href
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
