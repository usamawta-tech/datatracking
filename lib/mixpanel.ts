const MIXPANEL_API = "https://api.mixpanel.com";
const MIXPANEL_DATA_API = "https://data.mixpanel.com/api/2.0";

export async function validateMixpanelCredentials(
  projectToken: string,
  serviceAccountUser: string,
  serviceAccountSecret: string,
  projectId?: string | null
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!projectId) return { valid: true };
    const auth = Buffer.from(`${serviceAccountUser}:${serviceAccountSecret}`).toString("base64");
    const res = await fetch(
      `${MIXPANEL_DATA_API}/funnels/list?project_id=${encodeURIComponent(projectId)}`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { valid: false, error: `Mixpanel API returned ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}` };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Network error reaching Mixpanel" };
  }
}

// Server-side event tracking — sends directly to Mixpanel's ingestion API
export async function trackServerEvent(
  projectToken: string,
  eventName: string,
  properties: Record<string, unknown>
): Promise<boolean> {
  try {
    const payload = [
      {
        event: eventName,
        properties: {
          token: projectToken,
          time: Math.floor(Date.now() / 1000),
          ...properties,
        },
      },
    ];
    const res = await fetch(`${MIXPANEL_API}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/plain" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function trackEvent(
  projectToken: string,
  eventName: string,
  properties: Record<string, unknown>
) {
  return trackServerEvent(projectToken, eventName, properties);
}

export async function importEvents(
  projectToken: string,
  serviceAccountUser: string,
  serviceAccountSecret: string,
  events: Array<{ event: string; properties: Record<string, unknown> }>,
  projectId?: string | null
) {
  const auth = Buffer.from(`${serviceAccountUser}:${serviceAccountSecret}`).toString("base64");
  const payload = events.map((e) => ({
    event: e.event,
    properties: { token: projectToken, ...e.properties },
  }));
  const res = await fetch(`${MIXPANEL_API}/import?strict=1&project_id=${projectId || projectToken}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
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
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) return null;
  return res.json();
}
