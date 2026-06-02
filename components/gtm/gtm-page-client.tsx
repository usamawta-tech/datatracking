"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type FunnelStep = { name: string; url: string; eventName: string };
type Funnel = {
  id: string;
  name: string;
  websiteUrl: string;
  steps: FunnelStep[];
  generatedTags: Array<{ id: string; name: string; status: string }>;
};

interface GtmPageClientProps {
  connected: boolean;
  accountId: string | null;
  containerId: string | null;
  workspaceId: string | null;
  funnels: Funnel[];
  mixpanelToken: string | null;
  mixpanelConnected: boolean;
  activated: boolean;
}

export function GtmPageClient({
  connected,
  accountId,
  containerId,
  workspaceId,
  funnels,
  mixpanelToken,
  mixpanelConnected,
  activated: initialActivated,
}: GtmPageClientProps) {
  const [accounts, setAccounts] = useState<Array<{ accountId: string; name: string }>>([]);
  const [containers, setContainers] = useState<Array<{ containerId: string; name: string }>>([]);
  const [workspaces, setWorkspaces] = useState<Array<{ workspaceId: string; name: string }>>([]);
  const [selAccount, setSelAccount] = useState(accountId || "");
  const [selContainer, setSelContainer] = useState(containerId || "");
  const [selWorkspace, setSelWorkspace] = useState(workspaceId || "");
  // Saved selection — updated after "Save selection" so buttons work without page reload
  const [savedAccountId, setSavedAccountId] = useState(accountId);
  const [savedContainerId, setSavedContainerId] = useState(containerId);
  const [savedWorkspaceId, setSavedWorkspaceId] = useState(workspaceId);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(initialActivated);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success"|"error">("success");

  // New funnel form
  const [funnelName, setFunnelName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [steps, setSteps] = useState<FunnelStep[]>([{ name: "", url: "", eventName: "" }]);
  const [creating, setCreating] = useState(false);
  const [autoTagging, setAutoTagging] = useState<string | null>(null);
  const [localFunnels, setLocalFunnels] = useState(funnels);

  async function activate() {
    setActivating(true);
    setMsg("");
    const res = await fetch("/api/gtm/activate", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      setActivated(true);
      setMsg(`✓ ${data.tagsCreated.length} tags created and published in GTM! Mixpanel is now tracking on your website.`);
      setMsgType("success");
    } else {
      setMsg(data.error || "Activation failed");
      setMsgType("error");
    }
    setActivating(false);
  }

  async function handleConnect() {
    window.location.href = "/api/gtm/connect";
  }

  async function loadAccounts() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/gtm/accounts");
    const data = await res.json();
    if (data.accounts) setAccounts(data.accounts);
    else setMsg(data.error || "Failed to load accounts");
    setLoading(false);
  }

  async function loadContainers() {
    if (!selAccount) return;
    setLoading(true);
    const res = await fetch(`/api/gtm/containers?accountId=${selAccount}`);
    const data = await res.json();
    if (data.containers) setContainers(data.containers);
    setLoading(false);
  }

  async function loadWorkspaces() {
    if (!selAccount || !selContainer) return;
    setLoading(true);
    const res = await fetch(`/api/gtm/workspaces?accountId=${selAccount}&containerId=${selContainer}`);
    const data = await res.json();
    if (data.workspaces) setWorkspaces(data.workspaces);
    setLoading(false);
  }

  async function saveSelection() {
    setLoading(true);
    const res = await fetch("/api/gtm/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selAccount, containerId: selContainer, workspaceId: selWorkspace }),
    });
    const data = await res.json();
    if (data.success || data.message) {
      setSavedAccountId(selAccount);
      setSavedContainerId(selContainer);
      setSavedWorkspaceId(selWorkspace);
    }
    setMsg(data.message || data.error || "");
    setLoading(false);
  }

  function addStep() {
    setSteps([...steps, { name: "", url: "", eventName: "" }]);
  }

  function updateStep(i: number, field: keyof FunnelStep, value: string) {
    const updated = [...steps];
    updated[i] = { ...updated[i], [field]: value };
    setSteps(updated);
  }

  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  async function createFunnel() {
    if (!funnelName || !websiteUrl || steps.some((s) => !s.name || !s.url || !s.eventName)) {
      setMsg("Please fill in all funnel fields");
      return;
    }
    setCreating(true);
    setMsg("");
    const res = await fetch("/api/funnels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: funnelName, websiteUrl, steps }),
    });
    const data = await res.json();
    if (data.funnel) {
      setLocalFunnels([{ ...data.funnel, generatedTags: [] }, ...localFunnels]);
      setFunnelName("");
      setWebsiteUrl("");
      setSteps([{ name: "", url: "", eventName: "" }]);
      setMsg("Funnel created!");
    } else {
      setMsg(data.error || "Failed to create funnel");
    }
    setCreating(false);
  }

  async function autoTag(funnelId: string) {
    if (!mixpanelToken) {
      setMsg("Please connect Mixpanel first to auto-generate tags");
      return;
    }
    setAutoTagging(funnelId);
    setMsg("");
    const res = await fetch("/api/gtm/auto-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelId }),
    });
    const data = await res.json();
    if (data.tags) {
      setMsg(`Created ${data.tags.length} tags in GTM!`);
      setLocalFunnels(
        localFunnels.map((f) =>
          f.id === funnelId
            ? { ...f, generatedTags: [...f.generatedTags, ...data.tags] }
            : f
        )
      );
    } else {
      setMsg(data.error || "Auto-tagging failed");
    }
    setAutoTagging(null);
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Tag Manager</h1>
        <p className="text-gray-500 text-sm mt-1">Connect GTM and auto-generate tracking tags</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msgType === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {msg}
        </div>
      )}

      {/* Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>GTM Connection</CardTitle>
              <CardDescription>Authorize access to your Google Tag Manager account</CardDescription>
            </div>
            <Badge variant={connected ? "success" : "warning"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connected ? (
            <Button onClick={handleConnect}>Connect with Google</Button>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" onClick={loadAccounts} loading={loading}>
                  Load accounts
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await fetch("/api/gtm/disconnect", { method: "DELETE" });
                    window.location.reload();
                  }}
                >
                  Disconnect GTM
                </Button>
              </div>

              {accounts.length > 0 && (
                <div className="space-y-3">
                  {/* Account */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account {loading && <span className="text-blue-500 text-xs ml-1">Loading…</span>}
                    </label>
                    <select
                      value={selAccount}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setSelAccount(val);
                        setSelContainer("");
                        setSelWorkspace("");
                        setContainers([]);
                        setWorkspaces([]);
                        if (!val) return;
                        setLoading(true);
                        setMsg("");
                        try {
                          const r = await fetch(`/api/gtm/containers?accountId=${val}`);
                          const d = await r.json();
                          if (d.containers) setContainers(d.containers);
                          else setMsg(d.error || "Failed to load containers");
                        } catch {
                          setMsg("Failed to load containers");
                        }
                        setLoading(false);
                      }}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.accountId} value={a.accountId}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Container */}
                  {selAccount && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Container {loading && containers.length === 0 && <span className="text-blue-500 text-xs ml-1">Loading…</span>}
                      </label>
                      {containers.length > 0 ? (
                        <select
                          value={selContainer}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setSelContainer(val);
                            setSelWorkspace("");
                            setWorkspaces([]);
                            if (!val) return;
                            setLoading(true);
                            setMsg("");
                            try {
                              const r = await fetch(`/api/gtm/workspaces?accountId=${selAccount}&containerId=${val}`);
                              const d = await r.json();
                              if (d.workspaces) setWorkspaces(d.workspaces);
                              else setMsg(d.error || "Failed to load workspaces");
                            } catch {
                              setMsg("Failed to load workspaces");
                            }
                            setLoading(false);
                          }}
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select container…</option>
                          {containers.map((c) => (
                            <option key={c.containerId} value={c.containerId}>{c.name}</option>
                          ))}
                        </select>
                      ) : !loading ? (
                        <p className="text-xs text-red-500">No containers found for this account.</p>
                      ) : null}
                    </div>
                  )}

                  {/* Workspace */}
                  {selContainer && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Workspace {loading && workspaces.length === 0 && <span className="text-blue-500 text-xs ml-1">Loading…</span>}
                      </label>
                      {workspaces.length > 0 ? (
                        <select
                          value={selWorkspace}
                          onChange={(e) => setSelWorkspace(e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="">Select workspace…</option>
                          {workspaces.map((w) => (
                            <option key={w.workspaceId} value={w.workspaceId}>{w.name}</option>
                          ))}
                        </select>
                      ) : !loading ? (
                        <p className="text-xs text-red-500">No workspaces found for this container.</p>
                      ) : null}
                    </div>
                  )}

                  {/* Save button — always visible once account is loaded */}
                  {selAccount && selContainer && selWorkspace && (
                    <Button onClick={saveSelection} loading={loading} size="sm">
                      Save selection
                    </Button>
                  )}
                </div>
              )}

              {savedAccountId && savedContainerId && savedWorkspaceId && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-3 py-2">
                  Active: Account {savedAccountId} / Container {savedContainerId} / Workspace {savedWorkspaceId}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Activate Mixpanel Tracking ────────────────────────────────────── */}
      {connected && savedAccountId && savedContainerId && savedWorkspaceId && (
        <Card className={activated ? "border-green-200 bg-green-50/40" : "border-blue-200 bg-blue-50/40"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className={activated ? "text-green-800" : "text-blue-900"}>
                  {activated ? "✓ Mixpanel Tracking Active" : "Activate Mixpanel Tracking"}
                </CardTitle>
                <CardDescription className={activated ? "text-green-700" : "text-blue-700"}>
                  {activated
                    ? "Tags are published in GTM and firing on your website right now."
                    : "One click — creates all GTM tags and publishes them to your website instantly."}
                </CardDescription>
              </div>
              <Badge variant={activated ? "success" : mixpanelConnected ? "info" : "warning"}>
                {activated ? "Live" : mixpanelConnected ? "Ready" : "Connect Mixpanel first"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activated ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {["MP - Init", "MP - Page View", "MP - Button Click", "MP - Form Submit"].map((t) => (
                    <div key={t} className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                      <span className="text-green-500 text-xs">●</span>
                      <span className="text-xs font-medium text-gray-700">{t}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-700">
                  These tags are live in GTM. Every page view, button click, and form submit on your website is now tracked in Mixpanel automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {[
                    { icon: "📄", label: "Page View", desc: "Every page load" },
                    { icon: "🖱️", label: "Button Click", desc: "All clicks" },
                    { icon: "📋", label: "Form Submit", desc: "All forms" },
                    { icon: "⚡", label: "Mixpanel Init", desc: "SDK on all pages" },
                  ].map((t) => (
                    <div key={t.label} className="bg-white border border-blue-100 rounded-lg p-3">
                      <div className="text-lg">{t.icon}</div>
                      <div className="text-xs font-semibold text-gray-800 mt-1">{t.label}</div>
                      <div className="text-xs text-gray-400">{t.desc}</div>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={activate}
                  loading={activating}
                  disabled={!mixpanelConnected}
                >
                  {activating ? "Creating tags & publishing…" : "Activate Mixpanel Tracking"}
                </Button>
                {!mixpanelConnected && (
                  <p className="text-xs text-amber-600">
                    Connect Mixpanel first →{" "}
                    <a href="/mixpanel" className="underline font-medium">Go to Mixpanel</a>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create funnel */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Create funnel</CardTitle>
            <CardDescription>
              Define funnel steps — AI will create GTM tags and Mixpanel events automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Funnel name"
                placeholder="e.g. Checkout Funnel"
                value={funnelName}
                onChange={(e) => setFunnelName(e.target.value)}
              />
              <Input
                label="Website URL"
                placeholder="https://yoursite.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Funnel steps</label>
              {steps.map((step, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <Input
                    placeholder="Step name"
                    value={step.name}
                    onChange={(e) => updateStep(i, "name", e.target.value)}
                  />
                  <Input
                    placeholder="/page-path"
                    value={step.url}
                    onChange={(e) => updateStep(i, "url", e.target.value)}
                  />
                  <Input
                    placeholder="Event name"
                    value={step.eventName}
                    onChange={(e) => updateStep(i, "eventName", e.target.value)}
                  />
                  <button
                    onClick={() => removeStep(i)}
                    disabled={steps.length === 1}
                    className="text-gray-400 hover:text-red-500 text-lg pb-2 disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addStep}>
                + Add step
              </Button>
            </div>

            <Button onClick={createFunnel} loading={creating}>
              Create funnel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Funnels list */}
      {localFunnels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your funnels</CardTitle>
            <CardDescription>Auto-generate GTM tags &amp; Mixpanel events for each funnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {localFunnels.map((f) => (
              <div key={f.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{f.name}</div>
                    <div className="text-xs text-gray-400">{f.websiteUrl} · {f.steps.length} steps</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{f.generatedTags.length} tags</Badge>
                    <Button
                      size="sm"
                      onClick={() => autoTag(f.id)}
                      loading={autoTagging === f.id}
                      disabled={!savedAccountId || !savedContainerId || !savedWorkspaceId}
                    >
                      Auto-tag
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {f.steps.map((s, i) => (
                    <span key={i} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1">
                      {i + 1}. {s.name}
                    </span>
                  ))}
                </div>
                {f.generatedTags.length > 0 && (
                  <div className="space-y-1">
                    {f.generatedTags.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs text-gray-500">
                        <Badge variant={t.status === "published" ? "success" : "warning"} className="text-xs">
                          {t.status}
                        </Badge>
                        {t.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
