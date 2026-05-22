const MIXPANEL_API = "https://api.mixpanel.com";
const MIXPANEL_DATA_API = "https://data.mixpanel.com/api/2.0";

export async function validateMixpanelCredentials(
  projectToken: string,
  serviceAccountUser: string,
  serviceAccountSecret: string
) {
  // Test credentials by calling the engage endpoint
  const auth = Buffer.from(`${serviceAccountUser}:${serviceAccountSecret}`).toString("base64");
  const res = await fetch(`${MIXPANEL_DATA_API}/engage?project_token=${projectToken}&where=1&limit=1`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return res.ok;
}

export async function trackEvent(
  projectToken: string,
  eventName: string,
  properties: Record<string, unknown>
) {
  const event = {
    event: eventName,
    properties: { token: projectToken, ...properties },
  };
  const encoded = Buffer.from(JSON.stringify([event])).toString("base64");
  const res = await fetch(`${MIXPANEL_API}/track?data=${encodeURIComponent(encoded)}&ip=0`, {
    method: "GET",
  });
  return res.ok;
}

export async function importEvents(
  projectToken: string,
  serviceAccountUser: string,
  serviceAccountSecret: string,
  events: Array<{ event: string; properties: Record<string, unknown> }>
) {
  const auth = Buffer.from(`${serviceAccountUser}:${serviceAccountSecret}`).toString("base64");
  const payload = events.map((e) => ({
    event: e.event,
    properties: { token: projectToken, ...e.properties },
  }));
  const res = await fetch(`${MIXPANEL_API}/import?strict=1&project_id=${projectToken}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getFunnelData(
  projectId: string,
  serviceAccountUser: string,
  serviceAccountSecret: string,
  funnelId?: string
) {
  const auth = Buffer.from(`${serviceAccountUser}:${serviceAccountSecret}`).toString("base64");
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const url = funnelId
    ? `${MIXPANEL_DATA_API}/funnels?project_id=${projectId}&funnel_id=${funnelId}&from_date=${from}&to_date=${to}`
    : `${MIXPANEL_DATA_API}/funnels/list?project_id=${projectId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  return res.json();
}
