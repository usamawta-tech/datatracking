"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TagPlatform = "google_ads" | "ga4" | "meta" | "mixpanel";

interface TagConfig {
  platform: TagPlatform;
  enabled: boolean;
  tagId: string;
  eventName: string;
}

interface Campaign {
  id: string;
  name: string;
  pageUrl: string;
  triggerPath: string;
  tags: string;
  status: string;
  createdAt: string;
}

interface SetupWizardProps {
  connected: boolean;
  accountId: string | null;
  containerId: string | null;
  workspaceId: string | null;
  campaigns: Campaign[];
}

// ── Stepper ────────────────────────────────────────────────────────────────────

const STEPS = [
  "Connect GTM",
  "Install Script",
  "Landing Page",
  "Configure Tags",
  "Deploy",
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                  done
                    ? "bg-green-600 border-green-600 text-white"
                    : active
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-400",
                ].join(" ")}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={[
                  "text-sm font-medium hidden sm:block",
                  done
                    ? "text-green-700"
                    : active
                    ? "text-blue-700"
                    : "text-gray-400",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "flex-1 h-0.5 mx-2",
                  done ? "bg-green-400" : "bg-gray-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Platform label helpers ─────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<TagPlatform, string> = {
  google_ads: "Google Ads",
  ga4: "GA4",
  meta: "Meta (Facebook)",
  mixpanel: "Mixpanel",
};

const PLATFORM_TAG_ID_LABEL: Record<TagPlatform, string> = {
  google_ads: "Google Tag ID (e.g. AW-123456789)",
  ga4: "Measurement ID (e.g. G-XXXXXXXXXX)",
  meta: "Pixel ID",
  mixpanel: "Project Token",
};

const PLATFORM_EVENT_LABEL: Record<TagPlatform, string> = {
  google_ads: "Conversion Event Name",
  ga4: "Event Name",
  meta: "Event Name (e.g. Purchase)",
  mixpanel: "Event Name",
};

// ── Step 1 — Connect GTM ───────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Step1Connect({
  connected,
  initialAccountId,
  initialContainerId,
  initialWorkspaceId,
  onComplete,
}: {
  connected: boolean;
  initialAccountId: string | null;
  initialContainerId: string | null;
  initialWorkspaceId: string | null;
  onComplete: () => void;
}) {
  const allSaved = !!(initialAccountId && initialContainerId && initialWorkspaceId);

  const [accounts, setAccounts] = useState<Array<{ accountId: string; name: string }>>([]);
  const [containers, setContainers] = useState<Array<{ containerId: string; name: string }>>([]);
  const [workspaces, setWorkspaces] = useState<Array<{ workspaceId: string; name: string }>>([]);
  const [selAccount, setSelAccount] = useState(initialAccountId || "");
  const [selContainer, setSelContainer] = useState(initialContainerId || "");
  const [selWorkspace, setSelWorkspace] = useState(initialWorkspaceId || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // "summary" = show saved state | "select" = show dropdowns
  const [mode, setMode] = useState<"summary" | "select">(allSaved ? "summary" : "select");

  // Create new container inline form
  const [showCreate, setShowCreate] = useState(false);
  const [newContainerName, setNewContainerName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/gtm/accounts");
    const data = await res.json();
    if (data.accounts) setAccounts(data.accounts);
    else setError(data.error || "Failed to load accounts");
    setLoading(false);
  }

  async function onAccountChange(val: string) {
    setSelAccount(val);
    setSelContainer("");
    setSelWorkspace("");
    setContainers([]);
    setWorkspaces([]);
    setShowCreate(false);
    if (!val) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/gtm/containers?accountId=${val}`);
    const data = await res.json();
    if (data.containers) setContainers(data.containers);
    else setError(data.error || "Failed to load containers");
    setLoading(false);
  }

  async function onContainerChange(val: string) {
    setSelContainer(val);
    setSelWorkspace("");
    setWorkspaces([]);
    if (!val) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/gtm/workspaces?accountId=${selAccount}&containerId=${val}`);
    const data = await res.json();
    if (data.workspaces) setWorkspaces(data.workspaces);
    else setError(data.error || "Failed to load workspaces");
    setLoading(false);
  }

  async function createContainer() {
    if (!newContainerName.trim() || !selAccount) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/gtm/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selAccount, name: newContainerName.trim() }),
    });
    const data = await res.json();
    if (data.container) {
      setContainers((prev) => [...prev, data.container]);
      setSelContainer(data.container.containerId);
      setNewContainerName("");
      setShowCreate(false);
      // Load workspaces for the new container
      const wRes = await fetch(`/api/gtm/workspaces?accountId=${selAccount}&containerId=${data.container.containerId}`);
      const wData = await wRes.json();
      if (wData.workspaces) setWorkspaces(wData.workspaces);
    } else {
      setError(data.error || "Failed to create container");
    }
    setCreating(false);
  }

  async function saveAndContinue() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/gtm/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selAccount, containerId: selContainer, workspaceId: selWorkspace }),
    });
    const data = await res.json();
    if (data.success || data.message) {
      setMode("summary");
      onComplete();
    } else {
      setError(data.error || "Failed to save selection");
    }
    setSaving(false);
  }

  async function disconnect() {
    await fetch("/api/gtm/disconnect", { method: "DELETE" });
    window.location.reload();
  }

  // ── Not connected yet ────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Connect Google Tag Manager</h2>
          <p className="text-sm text-gray-500 mt-1">
            Authorize access to your GTM account to create and publish tags automatically.
          </p>
        </div>
        <button
          onClick={() => { window.location.href = "/api/gtm/connect"; }}
          className="inline-flex items-center gap-3 bg-white border border-gray-300 text-gray-800 px-5 py-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
        <p className="text-xs text-gray-400">
          This will request permissions to view, edit, and publish your GTM containers.
        </p>
      </div>
    );
  }

  // ── Summary view (already saved) ────────────────────────────────────────────
  if (mode === "summary") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">GTM Account</h2>
          <p className="text-sm text-gray-500 mt-1">Your Google Tag Manager connection is active.</p>
        </div>

        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-green-800 text-sm">Connected</p>
            <p className="text-xs text-green-700 mt-0.5">
              Account {initialAccountId} &nbsp;/&nbsp; Container {initialContainerId} &nbsp;/&nbsp; Workspace {initialWorkspaceId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setMode("select"); loadAccounts(); }}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Change Container
          </button>
          <button
            onClick={disconnect}
            className="text-red-600 text-sm font-medium hover:underline"
          >
            Disconnect GTM
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onComplete}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // ── Selection mode ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Select GTM Container</h2>
          <p className="text-sm text-gray-500 mt-1">Choose the account, container, and workspace to deploy tags to.</p>
        </div>
        <button onClick={disconnect} className="text-xs text-red-500 hover:underline shrink-0 mt-1">
          Disconnect
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {accounts.length === 0 ? (
        <button
          onClick={loadAccounts}
          disabled={loading}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-60 transition-colors inline-flex items-center gap-2"
        >
          {loading && <Spinner />}
          Load My Accounts
        </button>
      ) : (
        <div className="space-y-4">
          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={selAccount}
              onChange={(e) => onAccountChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select account...</option>
              {accounts.map((a) => (
                <option key={a.accountId} value={a.accountId}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Container */}
          {selAccount && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Container {loading && containers.length === 0 && <span className="text-blue-500 text-xs ml-1">Loading...</span>}
                </label>
                <button
                  onClick={() => setShowCreate((v) => !v)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  {showCreate ? "Cancel" : "+ Create new container"}
                </button>
              </div>

              {showCreate && (
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Container name (e.g. My Website)"
                    value={newContainerName}
                    onChange={(e) => setNewContainerName(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={createContainer}
                    disabled={creating || !newContainerName.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5"
                  >
                    {creating && <Spinner />}
                    Create
                  </button>
                </div>
              )}

              {containers.length > 0 ? (
                <select
                  value={selContainer}
                  onChange={(e) => onContainerChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select container...</option>
                  {containers.map((c) => (
                    <option key={c.containerId} value={c.containerId}>{c.name}</option>
                  ))}
                </select>
              ) : !loading && !showCreate ? (
                <p className="text-xs text-gray-500">No containers found. Create one above.</p>
              ) : null}
            </div>
          )}

          {/* Workspace */}
          {selContainer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workspace {loading && workspaces.length === 0 && <span className="text-blue-500 text-xs ml-1">Loading...</span>}
              </label>
              {workspaces.length > 0 ? (
                <select
                  value={selWorkspace}
                  onChange={(e) => setSelWorkspace(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select workspace...</option>
                  {workspaces.map((w) => (
                    <option key={w.workspaceId} value={w.workspaceId}>{w.name}</option>
                  ))}
                </select>
              ) : !loading ? (
                <p className="text-xs text-red-500">No workspaces found for this container.</p>
              ) : null}
            </div>
          )}

          {selAccount && selContainer && selWorkspace && (
            <div className="flex justify-end">
              <button
                onClick={saveAndContinue}
                disabled={saving}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-60 transition-colors inline-flex items-center gap-2"
              >
                {saving && <Spinner />}
                Save & Continue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 2 — Install Script ────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="text-xs border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function Step2Install({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [head, setHead] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    fetch("/api/gtm/snippet")
      .then((r) => r.json())
      .then((d) => {
        if (d.headSnippet) {
          setHead(d.headSnippet);
          setBody(d.bodySnippet);
        } else {
          setError(d.error || "Failed to load snippet");
        }
      })
      .catch(() => setError("Failed to load snippet"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Install GTM Script</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add these two snippets to your website to enable Google Tag Manager.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading snippet...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                1. Paste inside <code className="bg-gray-100 rounded px-1.5 py-0.5 text-xs">&lt;head&gt;</code>
              </p>
              <CopyButton text={head} />
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {head}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                2. Paste right after <code className="bg-gray-100 rounded px-1.5 py-0.5 text-xs">&lt;body&gt;</code>
              </p>
              <CopyButton text={body} />
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {body}
            </pre>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Step 3 — Landing Page ──────────────────────────────────────────────────────

function Step3LandingPage({
  pageUrl,
  setPageUrl,
  pageDesc,
  setPageDesc,
  triggerPath,
  setTriggerPath,
  onBack,
  onNext,
}: {
  pageUrl: string;
  setPageUrl: (v: string) => void;
  pageDesc: string;
  setPageDesc: (v: string) => void;
  triggerPath: string;
  setTriggerPath: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function handleUrlChange(val: string) {
    setPageUrl(val);
    try {
      const url = new URL(val);
      setTriggerPath(url.pathname);
    } catch {
      // not a valid URL yet — leave triggerPath alone
    }
  }

  const canProceed = pageUrl.trim() !== "" && triggerPath.trim() !== "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">What page do you want to track?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Specify the landing page where your tags will fire.
        </p>
      </div>

      <div className="space-y-4">
        <Input
          id="page-url"
          label="Page URL"
          placeholder="https://example.com/checkout"
          value={pageUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
        />
        <Input
          id="page-desc"
          label="Description (optional)"
          placeholder="e.g. Checkout page"
          value={pageDesc}
          onChange={(e) => setPageDesc(e.target.value)}
        />
        <Input
          id="trigger-path"
          label="URL path that will trigger tags (e.g. /checkout)"
          placeholder="/checkout"
          value={triggerPath}
          onChange={(e) => setTriggerPath(e.target.value)}
        />
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Step 4 — Configure Tags ────────────────────────────────────────────────────

const ALL_PLATFORMS: TagPlatform[] = ["google_ads", "ga4", "meta", "mixpanel"];

function Step4Tags({
  tags,
  setTags,
  onBack,
  onNext,
}: {
  tags: TagConfig[];
  setTags: (t: TagConfig[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function toggle(platform: TagPlatform) {
    setTags(
      tags.map((t) =>
        t.platform === platform ? { ...t, enabled: !t.enabled } : t
      )
    );
  }

  function setField(platform: TagPlatform, field: "tagId" | "eventName", value: string) {
    setTags(tags.map((t) => (t.platform === platform ? { ...t, [field]: value } : t)));
  }

  const enabledTags = tags.filter((t) => t.enabled);
  const canProceed =
    enabledTags.length > 0 &&
    enabledTags.every((t) => t.tagId.trim() !== "" && t.eventName.trim() !== "");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Which tags do you want to fire on this page?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enable each platform you want to track and fill in the required IDs.
        </p>
      </div>

      <div className="space-y-3">
        {tags.map((tag) => (
          <div
            key={tag.platform}
            className={[
              "rounded-xl border p-5 transition-colors",
              tag.enabled ? "border-blue-300 bg-blue-50/30" : "border-gray-200 bg-white",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`enable-${tag.platform}`}
                checked={tag.enabled}
                onChange={() => toggle(tag.platform)}
                className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <label
                htmlFor={`enable-${tag.platform}`}
                className="font-semibold text-gray-900 text-sm cursor-pointer select-none"
              >
                {PLATFORM_LABELS[tag.platform]}
              </label>
            </div>

            {tag.enabled && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={PLATFORM_TAG_ID_LABEL[tag.platform]}
                  placeholder={
                    tag.platform === "google_ads"
                      ? "AW-123456789"
                      : tag.platform === "ga4"
                      ? "G-XXXXXXXXXX"
                      : tag.platform === "meta"
                      ? "1234567890"
                      : "abc123..."
                  }
                  value={tag.tagId}
                  onChange={(e) => setField(tag.platform, "tagId", e.target.value)}
                />
                <Input
                  label={PLATFORM_EVENT_LABEL[tag.platform]}
                  placeholder={
                    tag.platform === "meta"
                      ? "Purchase"
                      : tag.platform === "google_ads"
                      ? "conversion"
                      : "page_view"
                  }
                  value={tag.eventName}
                  onChange={(e) => setField(tag.platform, "eventName", e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Step 5 — Review & Deploy ───────────────────────────────────────────────────

function Step5Deploy({
  pageUrl,
  pageDesc,
  triggerPath,
  tags,
  campaigns: initialCampaigns,
  onBack,
}: {
  pageUrl: string;
  pageDesc: string;
  triggerPath: string;
  tags: TagConfig[];
  campaigns: Campaign[];
  onBack: () => void;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ count: number; names: string[] } | null>(null);
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  const enabledTags = tags.filter((t) => t.enabled);

  async function deploy() {
    if (!campaignName.trim()) {
      setError("Please enter a campaign name");
      return;
    }
    setDeploying(true);
    setError("");
    setSuccess(null);

    try {
      // 1. Save campaign
      const platformTags = enabledTags.map((t) => ({
        platform: t.platform,
        tagId: t.tagId,
        eventName: t.eventName,
      }));

      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName.trim(),
          pageUrl,
          pageDesc,
          triggerPath,
          tags: JSON.stringify(platformTags),
        }),
      });
      const createData = await createRes.json();
      if (!createData.campaign) {
        setError(createData.error || "Failed to save campaign");
        setDeploying(false);
        return;
      }

      // 2. Deploy to GTM
      const deployRes = await fetch(`/api/campaigns/${createData.campaign.id}/deploy`, {
        method: "POST",
      });
      const deployData = await deployRes.json();
      if (deployData.success) {
        setSuccess({
          count: deployData.tags.length,
          names: deployData.tags.map((t: { name: string }) => t.name),
        });
        setCampaigns([
          { ...createData.campaign, status: "deployed" },
          ...campaigns,
        ]);
      } else {
        setError(deployData.error || "Deployment failed");
      }
    } catch {
      setError("An unexpected error occurred");
    }

    setDeploying(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Review & Deploy</h2>
        <p className="text-sm text-gray-500 mt-1">
          Review your configuration and publish tags to Google Tag Manager.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Trigger</p>
          <p className="text-sm text-gray-900">
            Page View on <code className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs">{triggerPath}</code>
          </p>
          {pageUrl && <p className="text-xs text-gray-400 mt-0.5">{pageUrl}</p>}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tags to create</p>
          <div className="space-y-2">
            {enabledTags.map((t) => (
              <div key={t.platform} className="flex items-start gap-3 text-sm">
                <span className="font-medium text-gray-700 w-28 shrink-0">{PLATFORM_LABELS[t.platform]}</span>
                <span className="text-gray-500 text-xs mt-0.5">
                  ID: <code className="bg-white border border-gray-200 rounded px-1 py-0.5">{t.tagId}</code> &mdash; Event: <code className="bg-white border border-gray-200 rounded px-1 py-0.5">{t.eventName}</code>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign name */}
      <Input
        id="campaign-name"
        label="Campaign Name"
        placeholder="e.g. Checkout Page Q2 2026"
        value={campaignName}
        onChange={(e) => setCampaignName(e.target.value)}
      />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {success && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-800 font-semibold">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            {success.count} tag{success.count !== 1 ? "s" : ""} created and published!
          </div>
          <ul className="space-y-1">
            {success.names.map((name) => (
              <li key={name} className="text-xs text-green-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"/>
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          disabled={deploying}
          className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Back
        </button>
        {!success && (
          <button
            onClick={deploy}
            disabled={deploying || enabledTags.length === 0}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
          >
            {deploying && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {deploying ? "Creating tags & publishing..." : "Create Tags & Publish to GTM"}
          </button>
        )}
      </div>

      {/* Previous campaigns */}
      {campaigns.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Previous Campaigns</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Page</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  let tagCount = 0;
                  try {
                    const parsed = JSON.parse(c.tags);
                    tagCount = Array.isArray(parsed) ? parsed.length : 0;
                  } catch { /* noop */ }
                  return (
                    <tr key={c.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 pr-4 text-gray-900 font-medium">{c.name}</td>
                      <td className="py-2.5 pr-4 text-gray-500 text-xs">{c.pageUrl}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={[
                            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                            c.status === "deployed"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600",
                          ].join(" ")}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-500 text-xs">{tagCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────

export function SetupWizard({
  connected,
  accountId,
  containerId,
  workspaceId,
  campaigns,
}: SetupWizardProps) {
  const [step, setStep] = useState(1);

  // Shared state across steps
  const [pageUrl, setPageUrl] = useState("");
  const [pageDesc, setPageDesc] = useState("");
  const [triggerPath, setTriggerPath] = useState("");
  const [tags, setTags] = useState<TagConfig[]>(
    ALL_PLATFORMS.map((p) => ({ platform: p, enabled: false, tagId: "", eventName: "" }))
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 5)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">GTM Setup</h1>
        <p className="text-gray-500 text-sm mt-1">
          Deploy tracking tags to Google Tag Manager in a few steps.
        </p>
      </div>

      <Stepper current={step} />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {step === 1 && (
          <Step1Connect
            connected={connected}
            initialAccountId={accountId}
            initialContainerId={containerId}
            initialWorkspaceId={workspaceId}
            onComplete={next}
          />
        )}
        {step === 2 && <Step2Install onBack={back} onNext={next} />}
        {step === 3 && (
          <Step3LandingPage
            pageUrl={pageUrl}
            setPageUrl={setPageUrl}
            pageDesc={pageDesc}
            setPageDesc={setPageDesc}
            triggerPath={triggerPath}
            setTriggerPath={setTriggerPath}
            onBack={back}
            onNext={next}
          />
        )}
        {step === 4 && (
          <Step4Tags tags={tags} setTags={setTags} onBack={back} onNext={next} />
        )}
        {step === 5 && (
          <Step5Deploy
            pageUrl={pageUrl}
            pageDesc={pageDesc}
            triggerPath={triggerPath}
            tags={tags}
            campaigns={campaigns}
            onBack={back}
          />
        )}
      </div>
    </div>
  );
}
