"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface MixpanelPageClientProps {
  connected: boolean;
  projectToken: string | null;
  serviceAccountUser: string | null;
  projectId: string | null;
}

export function MixpanelPageClient({
  connected: initialConnected,
  projectToken: initialToken,
  serviceAccountUser: initialUser,
  projectId: initialProjectId,
}: MixpanelPageClientProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [form, setForm] = useState({
    projectToken: initialToken || "",
    serviceAccountUser: initialUser || "",
    serviceAccountSecret: "",
    projectId: initialProjectId || "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [funnels, setFunnels] = useState<Array<{
    funnel_id: number;
    name: string;
    steps?: number;
  }>>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(false);

  function setField(field: keyof typeof form, value: string) {
    setForm({ ...form, [field]: value });
  }

  async function connect() {
    if (!form.projectToken || !form.serviceAccountUser || !form.serviceAccountSecret) {
      setMsg("Project Token, Service Account User and Secret are required");
      setMsgType("error");
      return;
    }
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/mixpanel/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      setConnected(true);
      setMsg("Mixpanel connected successfully!");
      setMsgType("success");
    } else {
      setMsg(data.error || "Failed to connect to Mixpanel");
      setMsgType("error");
    }
    setLoading(false);
  }

  async function disconnect() {
    setLoading(true);
    await fetch("/api/mixpanel/connect", { method: "DELETE" });
    setConnected(false);
    setMsg("Disconnected from Mixpanel");
    setMsgType("success");
    setLoading(false);
  }

  async function loadFunnels() {
    setLoadingFunnels(true);
    const res = await fetch("/api/mixpanel/funnels");
    const data = await res.json();
    if (data.funnels) setFunnels(data.funnels);
    else setMsg(data.error || "Failed to load funnels");
    setLoadingFunnels(false);
  }

  async function testEvent() {
    setLoading(true);
    const res = await fetch("/api/mixpanel/test-event", { method: "POST" });
    const data = await res.json();
    setMsg(data.success ? "Test event sent to Mixpanel!" : (data.error || "Failed to send test event"));
    setMsgType(data.success ? "success" : "error");
    setLoading(false);
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mixpanel</h1>
        <p className="text-gray-500 text-sm mt-1">Connect your Mixpanel project to receive tracking events</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msgType === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {msg}
        </div>
      )}

      {/* Connection card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mixpanel Connection</CardTitle>
              <CardDescription>Enter your Mixpanel project credentials</CardDescription>
            </div>
            <Badge variant={connected ? "success" : "warning"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Project Token"
              placeholder="Your Mixpanel project token"
              value={form.projectToken}
              onChange={(e) => setField("projectToken", e.target.value)}
              disabled={connected}
            />
            <Input
              label="Project ID (optional)"
              placeholder="Your Mixpanel project ID"
              value={form.projectId}
              onChange={(e) => setField("projectId", e.target.value)}
              disabled={connected}
            />
            <Input
              label="Service Account Username"
              placeholder="service-account@developer.mixpanel.com"
              value={form.serviceAccountUser}
              onChange={(e) => setField("serviceAccountUser", e.target.value)}
              disabled={connected}
            />
            <Input
              label="Service Account Secret"
              type="password"
              placeholder="Service account secret"
              value={form.serviceAccountSecret}
              onChange={(e) => setField("serviceAccountSecret", e.target.value)}
              disabled={connected}
            />
          </div>

          <div className="flex gap-3">
            {!connected ? (
              <Button onClick={connect} loading={loading}>
                Connect Mixpanel
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={testEvent} loading={loading} size="sm">
                  Send test event
                </Button>
                <Button variant="danger" onClick={disconnect} loading={loading} size="sm">
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {connected && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
              <strong>Token:</strong> {initialToken?.slice(0, 8)}…
              {initialUser && <> · <strong>Account:</strong> {initialUser}</>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>Events flow from GTM to Mixpanel automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-gray-600">
            {[
              "Connect your Mixpanel project using Project Token and Service Account credentials above",
              "Go to the GTM page and create a funnel with your website's conversion steps",
              "Click 'Auto-tag' on any funnel — AI creates GTM tags with Mixpanel event code embedded",
              "GTM fires the tags automatically when users visit matching pages",
              "Events appear in your Mixpanel project as custom events for each funnel step",
              "Use Mixpanel's Funnels report to visualize conversion rates",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Mixpanel funnels */}
      {connected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mixpanel Funnels</CardTitle>
                <CardDescription>Existing funnels in your Mixpanel project</CardDescription>
              </div>
              <Button variant="secondary" size="sm" onClick={loadFunnels} loading={loadingFunnels}>
                Load funnels
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {funnels.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                Click &quot;Load funnels&quot; to fetch your existing Mixpanel funnels.
              </p>
            ) : (
              <div className="space-y-2">
                {funnels.map((f) => (
                  <div key={f.funnel_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="text-sm text-gray-900">{f.name}</div>
                    <Badge variant="info">ID: {f.funnel_id}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* GTM snippet for Mixpanel */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Mixpanel GTM Snippet</CardTitle>
            <CardDescription>
              Add this tag to your GTM container to initialize the Mixpanel SDK on all pages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">
{`<!-- Mixpanel Init Tag (Custom HTML) -->
<script>
(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){
function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);
a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}
var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];
a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};
a.people.toString=function(){return a.toString(1)+".people (stub)"};
i="disable time_event track track_pageview track_links track_forms register register_once unregister identify name_tag set_config reset people.set people.set_once people.increment people.append people.union people.track_charge people.clear_charges people.delete_user".split(" ");
for(h=0;h<i.length;h++)g(a,i[h]);b._i.push([e,f,c])};b.__SV=1.1}
})(document,window.mixpanel||[]);
mixpanel.init("${initialToken || 'YOUR_PROJECT_TOKEN'}", {track_pageview: true});
</script>`}
            </pre>
            <p className="text-xs text-gray-400 mt-2">
              Add this as a Custom HTML tag in GTM with an All Pages trigger. It initializes Mixpanel before any funnel tags fire.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
