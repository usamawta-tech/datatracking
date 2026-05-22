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
}

export function GtmPageClient({
  connected,
  accountId,
  containerId,
  workspaceId,
  funnels,
  mixpanelToken,
}: GtmPageClientProps) {
  const [accounts, setAccounts] = useState<Array<{ accountId: string; name: string }>>([]);
  const [containers, setContainers] = useState<Array<{ containerId: string; name: string }>>([]);
  const [workspaces, setWorkspaces] = useState<Array<{ workspaceId: string; name: string }>>([]);
  const [selAccount, setSelAccount] = useState(accountId || "");
  const [selContainer, setSelContainer] = useState(containerId || "");
  const [selWorkspace, setSelWorkspace] = useState(workspaceId || "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // New funnel form
  const [funnelName, setFunnelName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [steps, setSteps] = useState<FunnelStep[]>([{ name: "", url: "", eventName: "" }]);
  const [creating, setCreating] = useState(false);
  const [autoTagging, setAutoTagging] = useState<string | null>(null);
  const [localFunnels, setLocalFunnels] = useState(funnels);

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
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.includes("!") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
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
              </div>

              {accounts.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                    <select
                      value={selAccount}
                      onChange={(e) => { setSelAccount(e.target.value); setContainers([]); setWorkspaces([]); }}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      onBlur={loadContainers}
                    >
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.accountId} value={a.accountId}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {containers.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Container</label>
                      <select
                        value={selContainer}
                        onChange={(e) => { setSelContainer(e.target.value); setWorkspaces([]); }}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        onBlur={loadWorkspaces}
                      >
                        <option value="">Select container…</option>
                        {containers.map((c) => (
                          <option key={c.containerId} value={c.containerId}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {workspaces.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Workspace</label>
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
                    </div>
                  )}

                  <Button onClick={saveSelection} loading={loading} size="sm">
                    Save selection
                  </Button>
                </div>
              )}

              {accountId && containerId && workspaceId && (
                <div className="text-xs text-green-700 bg-green-50 rounded px-3 py-2">
                  Active: Account {accountId} / Container {containerId} / Workspace {workspaceId}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                      disabled={!accountId || !containerId || !workspaceId}
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
