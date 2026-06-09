"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";

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
  const [showAdvanced, setShowAdvanced] = useState(!!(initialUser || initialProjectId));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [funnels, setFunnels] = useState<Array<{ funnel_id: number; name: string }>>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(false);
  const [copied, setCopied] = useState(false);

  function setField(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function flash(text: string, ok: boolean) {
    setMsg(text);
    setMsgOk(ok);
  }

  async function connect() {
    if (!form.projectToken.trim()) {
      flash("Project Token is required", false);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/mixpanel/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setConnected(true);
        flash("Mixpanel connected successfully!", true);
      } else {
        flash(data.error || "Failed to connect", false);
      }
    } catch {
      flash("Network error — please try again", false);
    }
    setLoading(false);
  }

  async function disconnect() {
    setLoading(true);
    await fetch("/api/mixpanel/connect", { method: "DELETE" });
    setConnected(false);
    flash("Disconnected from Mixpanel", true);
    setLoading(false);
  }

  async function loadFunnels() {
    setLoadingFunnels(true);
    const res = await fetch("/api/mixpanel/funnels");
    const data = await res.json();
    if (data.funnels) setFunnels(data.funnels);
    else flash(data.error || "Failed to load funnels", false);
    setLoadingFunnels(false);
  }

  async function testEvent() {
    setLoading(true);
    const res = await fetch("/api/mixpanel/test-event", { method: "POST" });
    const data = await res.json();
    flash(data.success ? "Test event sent to Mixpanel!" : (data.error || "Failed to send test event"), data.success);
    setLoading(false);
  }

  const snippet = `<!-- Mixpanel Init Tag (Custom HTML) -->
<script>
(function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){
function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);
a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}
var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];
a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};
i="disable time_event track track_pageview track_links track_forms register register_once unregister identify name_tag set_config reset people.set people.set_once people.increment people.append people.union people.track_charge people.clear_charges people.delete_user".split(" ");
for(h=0;h<i.length;h++)g(a,i[h]);b._i.push([e,f,c])};b.__SV=1.1}
})(document,window.mixpanel||[]);
mixpanel.init("${initialToken || 'YOUR_PROJECT_TOKEN'}", {track_pageview: true});
</script>`;

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Mixpanel</h1>
        <p className="text-sm text-gray-400 mt-0.5">Connect your project to receive tracking events</p>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm border flex items-center gap-2.5 ${msgOk ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {msgOk ? (
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          {msg}
        </div>
      )}

      {/* Connection card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Status banner */}
        <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between ${connected ? "bg-green-50" : "bg-gray-50"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connected ? "bg-green-600" : "bg-gray-300"}`}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className={`text-sm font-semibold ${connected ? "text-green-800" : "text-gray-700"}`}>
                {connected ? "Mixpanel Connected" : "Mixpanel Not Connected"}
              </p>
              {connected && initialToken && (
                <p className="text-xs text-green-600 mt-0.5">Token: {initialToken.slice(0, 8)}…{initialUser && ` · ${initialUser}`}</p>
              )}
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
            {connected ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="p-6 space-y-5">
          {!connected ? (
            <>
              <Input
                label="Project Token"
                placeholder="e.g. a1b2c3d4e5f6..."
                value={form.projectToken}
                onChange={(e) => setField("projectToken", e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Find your token in{" "}
                <span className="text-gray-600 font-medium">Mixpanel → Settings → Project Settings</span>
              </p>

              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Advanced — Service Account (optional, for reading funnels)
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Input
                    label="Project ID"
                    placeholder="Numeric project ID"
                    value={form.projectId}
                    onChange={(e) => setField("projectId", e.target.value)}
                  />
                  <Input
                    label="Service Account Username"
                    placeholder="user@developer.mixpanel.com"
                    value={form.serviceAccountUser}
                    onChange={(e) => setField("serviceAccountUser", e.target.value)}
                  />
                  <div className="md:col-span-2">
                    <Input
                      label="Service Account Secret"
                      type="password"
                      placeholder="Service account secret"
                      value={form.serviceAccountSecret}
                      onChange={(e) => setField("serviceAccountSecret", e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={connect}
                disabled={loading}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                Connect Mixpanel
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={testEvent}
                disabled={loading}
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                Send test event
              </button>
              <button
                onClick={disconnect}
                disabled={loading}
                className="inline-flex items-center gap-2 text-red-600 hover:text-red-800 hover:bg-red-50 font-medium text-sm px-4 py-2 rounded-lg border border-red-200 transition-colors disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">How it works</h2>
          <p className="text-xs text-gray-400 mt-0.5">Events flow from GTM to Mixpanel automatically</p>
        </div>
        <div className="p-6">
          <ol className="space-y-4">
            {[
              { n: 1, text: "Paste your Mixpanel Project Token above and click Connect." },
              { n: 2, text: "Go to GTM Setup and build a funnel with your conversion pages." },
              { n: 3, text: "Deploy — AI creates GTM tags with Mixpanel event code embedded." },
              { n: 4, text: "GTM fires the tags when users visit matching pages." },
              { n: 5, text: "Events appear in Mixpanel as custom events for each funnel step." },
            ].map((s) => (
              <li key={s.n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {s.n}
                </span>
                <span className="text-sm text-gray-600">{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Funnels */}
      {connected && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Mixpanel Funnels</h2>
              <p className="text-xs text-gray-400 mt-0.5">Existing funnels in your project</p>
            </div>
            <button
              onClick={loadFunnels}
              disabled={loadingFunnels}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {loadingFunnels && (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              Load funnels
            </button>
          </div>
          <div className="p-6">
            {funnels.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Click &quot;Load funnels&quot; to fetch your existing Mixpanel funnels.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {funnels.map((f) => (
                  <div key={f.funnel_id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-gray-800">{f.name}</span>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      ID: {f.funnel_id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GTM snippet */}
      {connected && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">GTM Snippet</h2>
              <p className="text-xs text-gray-400 mt-0.5">Add this Custom HTML tag to initialise Mixpanel on all pages</p>
            </div>
            <button
              onClick={copySnippet}
              className="text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="bg-slate-950 text-emerald-400 p-6 text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap">
            {snippet}
          </pre>
        </div>
      )}
    </div>
  );
}
