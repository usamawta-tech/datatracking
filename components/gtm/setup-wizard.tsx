"use client";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────────

export type TagPlatform = "google_ads" | "ga4" | "meta" | "mixpanel";

interface TagConfig {
  platform: TagPlatform;
  enabled: boolean;
  tagId: string;
  eventName: string;
}

interface FunnelPage {
  id: string;
  pageUrl: string;
  pageDesc: string;
  triggerPath: string;
  tags: TagConfig[];
}

interface DeployResult {
  pageLabel: string;
  success: boolean;
  tagNames?: string[];
  error?: string;
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

// ── Constants ──────────────────────────────────────────────────────────────────

const ALL_PLATFORMS: TagPlatform[] = ["google_ads", "ga4", "meta", "mixpanel"];

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

const PLATFORM_COLORS: Record<TagPlatform, string> = {
  google_ads: "bg-blue-100 text-blue-700",
  ga4:        "bg-orange-100 text-orange-700",
  meta:       "bg-sky-100 text-sky-700",
  mixpanel:   "bg-purple-100 text-purple-700",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

let _pid = 0;

function createDefaultTags(): TagConfig[] {
  return ALL_PLATFORMS.map((p) => ({ platform: p, enabled: false, tagId: "", eventName: "" }));
}

function createNewPage(): FunnelPage {
  return { id: `p${++_pid}`, pageUrl: "", pageDesc: "", triggerPath: "", tags: createDefaultTags() };
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg className={`${sm ? "w-3.5 h-3.5" : "w-4 h-4"} animate-spin shrink-0`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function BtnPrimary({ onClick, disabled, loading, children, className = "" }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function BtnSecondary({ onClick, disabled, children, className = "" }: {
  onClick?: () => void; disabled?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function BtnDanger({ onClick, disabled, loading, children, className = "" }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function BtnGhost({ onClick, disabled, children, className = "" }: {
  onClick?: () => void; disabled?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function Select({ value, onChange, children, loading: ld }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; loading?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={ld}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-60 appearance-none pr-8"
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        {ld ? <Spinner sm /> : (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
      <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      {msg}
    </div>
  );
}

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
      className="inline-flex items-center gap-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── Stepper ────────────────────────────────────────────────────────────────────

const STEPS = ["Connect GTM", "Install Script", "Funnel Setup", "Review", "Deploy"];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div className={[
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                done   ? "bg-green-500 border-green-500 text-white shadow-sm shadow-green-200"
                : active ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200"
                :          "bg-white border-gray-200 text-gray-400",
              ].join(" ")}>
                {done ? (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : step}
              </div>
              <span className={[
                "text-xs font-semibold hidden sm:block",
                done ? "text-green-600" : active ? "text-indigo-700" : "text-gray-400",
              ].join(" ")}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={["flex-1 h-0.5 mx-3 rounded-full transition-colors", done ? "bg-green-400" : "bg-gray-200"].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1 — Connect GTM ───────────────────────────────────────────────────────

function Step1Connect({
  connected, initialAccountId, initialContainerId, initialWorkspaceId, onComplete,
}: {
  connected: boolean; initialAccountId: string | null;
  initialContainerId: string | null; initialWorkspaceId: string | null;
  onComplete: () => void;
}) {
  const allSaved = !!(initialAccountId && initialContainerId && initialWorkspaceId);

  const [accounts, setAccounts]   = useState<Array<{ accountId: string; name: string }>>([]);
  const [containers, setContainers] = useState<Array<{ containerId: string; name: string }>>([]);
  const [workspaces, setWorkspaces] = useState<Array<{ workspaceId: string; name: string }>>([]);
  const [selAccount, setSelAccount]   = useState(initialAccountId || "");
  const [selContainer, setSelContainer] = useState(initialContainerId || "");
  const [selWorkspace, setSelWorkspace] = useState(initialWorkspaceId || "");
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [mode, setMode]         = useState<"summary" | "select">(allSaved ? "summary" : "select");
  const [showCreate, setShowCreate] = useState(false);
  const [newContainerName, setNewContainerName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadAccounts() {
    setLoading(true); setError("");
    const res = await fetch("/api/gtm/accounts");
    const data = await res.json();
    if (data.accounts) setAccounts(data.accounts);
    else setError(data.error || "Failed to load accounts");
    setLoading(false);
  }

  async function onAccountChange(val: string) {
    setSelAccount(val); setSelContainer(""); setSelWorkspace("");
    setContainers([]); setWorkspaces([]); setShowCreate(false);
    if (!val) return;
    setLoading(true); setError("");
    const res = await fetch(`/api/gtm/containers?accountId=${val}`);
    const data = await res.json();
    if (data.containers) setContainers(data.containers);
    else setError(data.error || "Failed to load containers");
    setLoading(false);
  }

  async function onContainerChange(val: string) {
    setSelContainer(val); setSelWorkspace(""); setWorkspaces([]);
    if (!val) return;
    setLoading(true); setError("");
    const res = await fetch(`/api/gtm/workspaces?accountId=${selAccount}&containerId=${val}`);
    const data = await res.json();
    if (data.workspaces) setWorkspaces(data.workspaces);
    else setError(data.error || "Failed to load workspaces");
    setLoading(false);
  }

  async function createContainer() {
    if (!newContainerName.trim() || !selAccount) return;
    setCreating(true); setError("");
    const res = await fetch("/api/gtm/containers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selAccount, name: newContainerName.trim() }),
    });
    const data = await res.json();
    if (data.container) {
      setContainers((prev) => [...prev, data.container]);
      setSelContainer(data.container.containerId);
      setNewContainerName(""); setShowCreate(false);
      const wRes = await fetch(`/api/gtm/workspaces?accountId=${selAccount}&containerId=${data.container.containerId}`);
      const wData = await wRes.json();
      if (wData.workspaces) setWorkspaces(wData.workspaces);
    } else setError(data.error || "Failed to create container");
    setCreating(false);
  }

  async function saveAndContinue() {
    setSaving(true); setError("");
    const res = await fetch("/api/gtm/select", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: selAccount, containerId: selContainer, workspaceId: selWorkspace }),
    });
    const data = await res.json();
    if (data.success || data.message) { setMode("summary"); onComplete(); }
    else setError(data.error || "Failed to save selection");
    setSaving(false);
  }

  async function disconnect() {
    await fetch("/api/gtm/disconnect", { method: "DELETE" });
    window.location.reload();
  }

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Connect Google Tag Manager</h2>
          <p className="text-sm text-gray-500 mt-1">Authorize access to create and publish tags automatically.</p>
        </div>
        <button
          onClick={() => { window.location.href = "/api/gtm/connect"; }}
          className="inline-flex items-center gap-3 bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <p className="text-xs text-gray-400">Requests permission to view, edit, and publish your GTM containers.</p>
      </div>
    );
  }

  // ── Summary view ─────────────────────────────────────────────────────────────
  if (mode === "summary") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">GTM Account</h2>
          <p className="text-sm text-gray-500 mt-1">Your Google Tag Manager connection is active.</p>
        </div>

        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
          <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-green-800 text-sm">Connected to GTM</p>
            <p className="text-xs text-green-600 mt-0.5">
              Account {initialAccountId} · Container {initialContainerId} · Workspace {initialWorkspaceId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <BtnSecondary onClick={() => { setMode("select"); loadAccounts(); }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Change Container
          </BtnSecondary>
          <BtnDanger onClick={disconnect}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Disconnect GTM
          </BtnDanger>
        </div>

        <div className="flex justify-end pt-2">
          <BtnPrimary onClick={onComplete}>
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </BtnPrimary>
        </div>
      </div>
    );
  }

  // ── Select mode ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Select GTM Container</h2>
          <p className="text-sm text-gray-500 mt-1">Choose the account, container, and workspace to deploy tags to.</p>
        </div>
        <BtnDanger onClick={disconnect} className="shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Disconnect
        </BtnDanger>
      </div>

      {error && <ErrorBanner msg={error} />}

      {accounts.length === 0 ? (
        <BtnPrimary onClick={loadAccounts} loading={loading}>
          Load My Accounts
        </BtnPrimary>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Account</label>
            <Select value={selAccount} onChange={onAccountChange} loading={loading && !selAccount}>
              <option value="">Select account…</option>
              {accounts.map((a) => <option key={a.accountId} value={a.accountId}>{a.name}</option>)}
            </Select>
          </div>

          {selAccount && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Container</label>
                <BtnGhost onClick={() => setShowCreate((v) => !v)}>
                  {showCreate ? "Cancel" : "+ New container"}
                </BtnGhost>
              </div>

              {showCreate && (
                <div className="flex gap-2 mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <input
                    type="text"
                    placeholder="Container name (e.g. My Website)"
                    value={newContainerName}
                    onChange={(e) => setNewContainerName(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <BtnPrimary onClick={createContainer} loading={creating} disabled={!newContainerName.trim()}>
                    Create
                  </BtnPrimary>
                </div>
              )}

              {containers.length > 0 ? (
                <Select value={selContainer} onChange={onContainerChange} loading={loading && !selContainer}>
                  <option value="">Select container…</option>
                  {containers.map((c) => <option key={c.containerId} value={c.containerId}>{c.name}</option>)}
                </Select>
              ) : !loading && !showCreate ? (
                <p className="text-xs text-gray-500 py-2">No containers found. Create one above.</p>
              ) : null}
            </div>
          )}

          {selContainer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace</label>
              {workspaces.length > 0 ? (
                <Select value={selWorkspace} onChange={setSelWorkspace} loading={loading && !selWorkspace}>
                  <option value="">Select workspace…</option>
                  {workspaces.map((w) => <option key={w.workspaceId} value={w.workspaceId}>{w.name}</option>)}
                </Select>
              ) : !loading ? (
                <p className="text-xs text-red-500 py-2">No workspaces found for this container.</p>
              ) : null}
            </div>
          )}

          {selAccount && selContainer && selWorkspace && (
            <div className="flex justify-end pt-2">
              <BtnPrimary onClick={saveAndContinue} loading={saving}>
                Save &amp; Continue
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </BtnPrimary>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 2 — Install Script ────────────────────────────────────────────────────

function Step2Install({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [head, setHead]       = useState("");
  const [body, setBody]       = useState("");

  useEffect(() => {
    fetch("/api/gtm/snippet")
      .then((r) => r.json())
      .then((d) => {
        if (d.headSnippet) { setHead(d.headSnippet); setBody(d.bodySnippet); }
        else setError(d.error || "Failed to load snippet");
      })
      .catch(() => setError("Failed to load snippet"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Install GTM Script</h2>
        <p className="text-sm text-gray-500 mt-1">Add these two snippets to your website to activate Google Tag Manager.</p>
      </div>

      {error && <ErrorBanner msg={error} />}

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-gray-500 py-4">
          <Spinner />
          Loading snippet…
        </div>
      ) : (
        <div className="space-y-4">
          {[
            { label: "1. Paste inside", tag: "<head>", code: head },
            { label: "2. Paste right after", tag: "<body>", code: body },
          ].map((s) => (
            <div key={s.tag} className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-600">
                  {s.label}{" "}
                  <code className="bg-white border border-gray-200 rounded px-1.5 py-0.5">{s.tag}</code>
                </p>
                <CopyButton text={s.code} />
              </div>
              <pre className="bg-slate-950 text-emerald-400 p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {s.code}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <BtnSecondary onClick={onBack}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back
        </BtnSecondary>
        <BtnPrimary onClick={onNext}>
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </BtnPrimary>
      </div>
    </div>
  );
}

// ── PageInlineTags ─────────────────────────────────────────────────────────────

function PageInlineTags({ tags, onChange }: { tags: TagConfig[]; onChange: (t: TagConfig[]) => void }) {
  function toggle(p: TagPlatform) {
    onChange(tags.map((t) => (t.platform === p ? { ...t, enabled: !t.enabled } : t)));
  }
  function setField(p: TagPlatform, field: "tagId" | "eventName", v: string) {
    onChange(tags.map((t) => (t.platform === p ? { ...t, [field]: v } : t)));
  }

  return (
    <div className="space-y-2">
      {tags.map((tag) => (
        <div
          key={tag.platform}
          className={[
            "rounded-xl border transition-colors",
            tag.enabled ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200 bg-white",
          ].join(" ")}
        >
          <label className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none">
            <div className={[
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0",
              tag.enabled ? "bg-indigo-600 border-indigo-600" : "border-gray-300 bg-white",
            ].join(" ")} onClick={() => toggle(tag.platform)}>
              {tag.enabled && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <input type="checkbox" className="sr-only" checked={tag.enabled} onChange={() => toggle(tag.platform)} />
            <span className="text-sm font-medium text-gray-800">{PLATFORM_LABELS[tag.platform]}</span>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[tag.platform]}`}>
              {tag.platform.replace("_", " ")}
            </span>
          </label>

          {tag.enabled && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-indigo-100">
              <div className="pt-3">
                <Input
                  label={PLATFORM_TAG_ID_LABEL[tag.platform]}
                  placeholder={tag.platform === "google_ads" ? "AW-123456789" : tag.platform === "ga4" ? "G-XXXXXXXXXX" : tag.platform === "meta" ? "1234567890" : "abc123…"}
                  value={tag.tagId}
                  onChange={(e) => setField(tag.platform, "tagId", e.target.value)}
                />
              </div>
              <div className="pt-3">
                <Input
                  label={PLATFORM_EVENT_LABEL[tag.platform]}
                  placeholder={tag.platform === "meta" ? "Purchase" : tag.platform === "google_ads" ? "conversion" : "page_view"}
                  value={tag.eventName}
                  onChange={(e) => setField(tag.platform, "eventName", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── FunnelPageCard ─────────────────────────────────────────────────────────────

function FunnelPageCard({
  page, pageNumber, canRemove, expanded,
  onToggleExpand, onUrlChange, onDescChange, onPathChange, onTagsChange, onRemove,
}: {
  page: FunnelPage; pageNumber: number; canRemove: boolean; expanded: boolean;
  onToggleExpand: () => void; onUrlChange: (v: string) => void;
  onDescChange: (v: string) => void; onPathChange: (v: string) => void;
  onTagsChange: (t: TagConfig[]) => void; onRemove: () => void;
}) {
  const enabledCount = page.tags.filter((t) => t.enabled).length;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-50 border-b border-gray-200">
        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {pageNumber}
        </div>
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
          {page.pageDesc || `Page ${pageNumber}`}
          {page.triggerPath && (
            <code className="ml-2 text-xs bg-white border border-gray-200 rounded-md px-1.5 py-0.5 font-normal text-gray-500">
              {page.triggerPath}
            </code>
          )}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            title="Remove page"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="p-5 space-y-4">
        <Input
          label="Page URL"
          placeholder="https://example.com/checkout"
          value={page.pageUrl}
          onChange={(e) => onUrlChange(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Description (optional)"
            placeholder="e.g. Checkout page"
            value={page.pageDesc}
            onChange={(e) => onDescChange(e.target.value)}
          />
          <Input
            label="Trigger path"
            placeholder="/checkout"
            value={page.triggerPath}
            onChange={(e) => onPathChange(e.target.value)}
          />
        </div>

        {/* Tags toggle */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 w-full text-left group"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${expanded ? "bg-indigo-100" : "bg-gray-100 group-hover:bg-gray-200"}`}>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90 text-indigo-600" : "text-gray-500"}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <span className={`text-sm font-semibold transition-colors ${expanded ? "text-indigo-700" : "text-gray-700 group-hover:text-gray-900"}`}>
              Configure Tags
            </span>
            {enabledCount > 0 ? (
              <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold">
                {enabledCount} enabled
              </span>
            ) : (
              <span className="ml-auto text-xs text-gray-400 font-medium">None configured</span>
            )}
          </button>

          {expanded && (
            <div className="mt-4">
              <PageInlineTags tags={page.tags} onChange={onTagsChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 3 — Funnel Builder ────────────────────────────────────────────────────

function Step3FunnelBuilder({
  pages, setPages, onBack, onNext,
}: {
  pages: FunnelPage[]; setPages: (p: FunnelPage[]) => void;
  onBack: () => void; onNext: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updatePage(id: string, patch: Partial<FunnelPage>) {
    setPages(pages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function handleUrlChange(id: string, val: string) {
    const patch: Partial<FunnelPage> = { pageUrl: val };
    try { patch.triggerPath = new URL(val).pathname; } catch { /* not a valid URL yet */ }
    updatePage(id, patch);
  }

  function addPage() {
    const p = createNewPage();
    setPages([...pages, p]);
    setExpandedId(p.id);
  }

  function removePage(id: string) {
    setPages(pages.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  const canProceed = pages.every((p) => p.pageUrl.trim() !== "" && p.triggerPath.trim() !== "");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Define Your Funnel</h2>
        <p className="text-sm text-gray-500 mt-1">Add pages in order and configure which tags fire on each step.</p>
      </div>

      <div className="space-y-1">
        {pages.map((page, i) => (
          <div key={page.id}>
            <FunnelPageCard
              page={page}
              pageNumber={i + 1}
              canRemove={pages.length > 1}
              expanded={expandedId === page.id}
              onToggleExpand={() => setExpandedId(expandedId === page.id ? null : page.id)}
              onUrlChange={(v) => handleUrlChange(page.id, v)}
              onDescChange={(v) => updatePage(page.id, { pageDesc: v })}
              onPathChange={(v) => updatePage(page.id, { triggerPath: v })}
              onTagsChange={(t) => updatePage(page.id, { tags: t })}
              onRemove={() => removePage(page.id)}
            />
            {i < pages.length - 1 && (
              <div className="flex justify-center py-2">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-px h-3 bg-gray-300" />
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addPage}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-2xl py-3.5 text-sm font-semibold transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Another Page
      </button>

      <div className="flex justify-between pt-2">
        <BtnSecondary onClick={onBack}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back
        </BtnSecondary>
        <BtnPrimary onClick={onNext} disabled={!canProceed}>
          Next — Review
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </BtnPrimary>
      </div>
    </div>
  );
}

// ── Step 4 — Review ────────────────────────────────────────────────────────────

function Step4Review({ pages, onBack, onNext }: {
  pages: FunnelPage[]; onBack: () => void; onNext: () => void;
}) {
  const pagesWithTags = pages.filter((p) => p.tags.some((t) => t.enabled));
  const canProceed = pagesWithTags.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Review Funnel</h2>
        <p className="text-sm text-gray-500 mt-1">Confirm your pages and tags before publishing to GTM.</p>
      </div>

      <div className="space-y-3">
        {pages.map((page, i) => {
          const enabledTags = page.tags.filter((t) => t.enabled);
          const hasNoTags = enabledTags.length === 0;
          return (
            <div key={page.id} className={`rounded-2xl border p-5 ${hasNoTags ? "border-amber-200 bg-amber-50/30" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${hasNoTags ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-700"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{page.pageDesc || `Page ${i + 1}`}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{page.pageUrl}</p>
                </div>
                <code className="text-xs bg-gray-100 rounded-lg px-2.5 py-1 text-gray-500 font-mono shrink-0">
                  {page.triggerPath}
                </code>
              </div>

              {hasNoTags ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  No tags configured — this page will be skipped on deploy.
                </div>
              ) : (
                <div className="space-y-1.5 pl-10">
                  {enabledTags.map((t) => (
                    <div key={t.platform} className="flex items-center gap-2 text-xs flex-wrap">
                      <span className={`font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[t.platform]}`}>
                        {PLATFORM_LABELS[t.platform]}
                      </span>
                      <span className="text-gray-400">ID:</span>
                      <code className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{t.tagId}</code>
                      <span className="text-gray-400">Event:</span>
                      <code className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">{t.eventName}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!canProceed && (
        <ErrorBanner msg="Configure tags on at least one page to continue." />
      )}

      <div className="flex justify-between pt-2">
        <BtnSecondary onClick={onBack}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back
        </BtnSecondary>
        <BtnPrimary onClick={onNext} disabled={!canProceed}>
          Continue to Deploy
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </BtnPrimary>
      </div>
    </div>
  );
}

// ── Step 5 — Deploy ────────────────────────────────────────────────────────────

function Step5Deploy({
  funnelPages, campaigns: initialCampaigns, onBack,
}: {
  funnelPages: FunnelPage[]; campaigns: Campaign[]; onBack: () => void;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [deploying, setDeploying]       = useState(false);
  const [error, setError]               = useState("");
  const [results, setResults]           = useState<DeployResult[] | null>(null);
  const [campaigns, setCampaigns]       = useState(initialCampaigns);

  const CAM_PAGE_SIZE = 5;
  const [camPage, setCamPage]                 = useState(0);
  const [editCamId, setEditCamId]             = useState<string | null>(null);
  const [editCamName, setEditCamName]         = useState("");
  const [savingCam, setSavingCam]             = useState(false);
  const [confirmDelCamId, setConfirmDelCamId] = useState<string | null>(null);
  const [deletingCam, setDeletingCam]         = useState(false);

  const pagesWithTags = funnelPages.filter((p) => p.tags.some((t) => t.enabled));
  const totalTags = pagesWithTags.reduce((s, p) => s + p.tags.filter((t) => t.enabled).length, 0);

  async function deploy() {
    if (!campaignName.trim()) { setError("Please enter a campaign name"); return; }
    setDeploying(true); setError(""); setResults(null);

    const newResults: DeployResult[] = [];
    const newCampaigns: Campaign[]   = [];

    for (const page of pagesWithTags) {
      const enabledTags = page.tags.filter((t) => t.enabled);
      const pageLabel = page.pageDesc ? `${campaignName} — ${page.pageDesc}` : `${campaignName} — ${page.triggerPath}`;
      try {
        const createRes = await fetch("/api/campaigns", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pageLabel, pageUrl: page.pageUrl, pageDesc: page.pageDesc,
            triggerPath: page.triggerPath,
            tags: JSON.stringify(enabledTags.map((t) => ({ platform: t.platform, tagId: t.tagId, eventName: t.eventName }))),
          }),
        });
        const createData = await createRes.json();
        if (!createData.campaign) { newResults.push({ pageLabel, success: false, error: createData.error || "Failed to save" }); continue; }

        const deployRes  = await fetch(`/api/campaigns/${createData.campaign.id}/deploy`, { method: "POST" });
        const deployData = await deployRes.json();
        if (deployData.success) {
          newResults.push({ pageLabel, success: true, tagNames: deployData.tags.map((t: { name: string }) => t.name) });
          newCampaigns.push({ ...createData.campaign, status: "deployed" });
        } else {
          newResults.push({ pageLabel, success: false, error: deployData.error || "Deployment failed" });
        }
      } catch {
        newResults.push({ pageLabel, success: false, error: "Unexpected error" });
      }
    }

    setResults(newResults);
    setCampaigns((prev) => [...newCampaigns, ...prev]);
    setDeploying(false);
  }

  async function deleteCampaign(id: string) {
    setDeletingCam(true);
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns((prev) => {
        const next = prev.filter((c) => c.id !== id);
        setCamPage((p) => Math.min(p, Math.max(0, Math.ceil(next.length / CAM_PAGE_SIZE) - 1)));
        return next;
      });
    }
    setConfirmDelCamId(null);
    setDeletingCam(false);
  }

  async function saveCampaignName(id: string) {
    if (!editCamName.trim()) return;
    setSavingCam(true);
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editCamName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, name: data.campaign.name } : c)));
      setEditCamId(null);
      setEditCamName("");
    }
    setSavingCam(false);
  }

  const camTotalPages  = Math.ceil(campaigns.length / CAM_PAGE_SIZE);
  const pageCampaigns  = campaigns.slice(camPage * CAM_PAGE_SIZE, (camPage + 1) * CAM_PAGE_SIZE);
  const allSuccess     = results?.every((r) => r.success);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Deploy to GTM</h2>
        <p className="text-sm text-gray-500 mt-1">
          Publish tags for {pagesWithTags.length} page{pagesWithTags.length !== 1 ? "s" : ""} · {totalTags} total tag{totalTags !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Funnel summary */}
      <div className="bg-slate-50 border border-gray-200 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Funnel</p>
        {pagesWithTags.map((page, i) => (
          <div key={page.id} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {page.pageDesc || page.triggerPath}
                <code className="ml-2 text-xs bg-white border border-gray-200 rounded-md px-1.5 py-0.5 font-normal text-gray-500">
                  {page.triggerPath}
                </code>
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {page.tags.filter((t) => t.enabled).map((t) => (
                  <span key={t.platform} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLORS[t.platform]}`}>
                    {PLATFORM_LABELS[t.platform]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Input
        id="campaign-name"
        label="Campaign Name"
        placeholder="e.g. Checkout Funnel Q2 2026"
        value={campaignName}
        onChange={(e) => setCampaignName(e.target.value)}
      />

      {error && <ErrorBanner msg={error} />}

      {results && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`rounded-2xl border p-4 flex items-start gap-3 ${r.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${r.success ? "bg-green-500" : "bg-red-500"}`}>
                {r.success ? (
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${r.success ? "text-green-800" : "text-red-800"}`}>{r.pageLabel}</p>
                {r.success && r.tagNames && (
                  <ul className="mt-1.5 space-y-0.5">
                    {r.tagNames.map((name) => (
                      <li key={name} className="flex items-center gap-1.5 text-xs text-green-700">
                        <span className="w-1 h-1 rounded-full bg-green-500 shrink-0" />
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
                {!r.success && r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
              </div>
            </div>
          ))}
          {allSuccess && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-700 font-semibold py-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              All pages deployed successfully!
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <BtnSecondary onClick={onBack} disabled={deploying}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back
        </BtnSecondary>
        {!allSuccess && (
          <BtnPrimary onClick={deploy} loading={deploying} disabled={pagesWithTags.length === 0}>
            {deploying ? "Deploying…" : "Publish to GTM"}
            {!deploying && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l4-4m0 0l-4-4m4 4H3m14 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </BtnPrimary>
        )}
      </div>

      {/* Previous campaigns */}
      {campaigns.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Previous Campaigns</h3>
            <span className="text-xs text-gray-400">{campaigns.length} total</span>
          </div>
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Page</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Tags</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageCampaigns.map((c) => {
                  let tagCount = 0;
                  try { const p = JSON.parse(c.tags); tagCount = Array.isArray(p) ? p.length : 0; } catch { /* noop */ }
                  const isEditing    = editCamId === c.id;
                  const isConfirming = confirmDelCamId === c.id;
                  return (
                    <tr key={c.id} className="group">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              className="flex-1 text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                              value={editCamName}
                              onChange={(e) => setEditCamName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveCampaignName(c.id);
                                if (e.key === "Escape") { setEditCamId(null); setEditCamName(""); }
                              }}
                            />
                            <button
                              onClick={() => saveCampaignName(c.id)}
                              disabled={savingCam}
                              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                            >
                              {savingCam ? "…" : "Save"}
                            </button>
                            <button
                              onClick={() => { setEditCamId(null); setEditCamName(""); }}
                              className="text-xs text-gray-500 hover:text-gray-700 px-1 shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : isConfirming ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-red-600 font-medium">Delete this campaign?</span>
                            <button
                              onClick={() => deleteCampaign(c.id)}
                              disabled={deletingCam}
                              className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deletingCam ? "Deleting…" : "Delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDelCamId(null)}
                              className="text-xs font-medium text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-900 font-medium text-sm">{c.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate hidden sm:table-cell">{c.pageUrl}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === "deployed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{tagCount}</td>
                      <td className="px-4 py-3 text-right">
                        {!isEditing && !isConfirming && (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditCamId(c.id); setEditCamName(c.name); setConfirmDelCamId(null); }}
                              title="Rename"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { setConfirmDelCamId(c.id); setEditCamId(null); }}
                              title="Delete"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {camTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-400">
                  {camPage * CAM_PAGE_SIZE + 1}–{Math.min((camPage + 1) * CAM_PAGE_SIZE, campaigns.length)} of {campaigns.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCamPage((p) => Math.max(0, p - 1))}
                    disabled={camPage === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-gray-500 px-2 font-medium">{camPage + 1} / {camTotalPages}</span>
                  <button
                    onClick={() => setCamPage((p) => Math.min(camTotalPages - 1, p + 1))}
                    disabled={camPage >= camTotalPages - 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────

export function SetupWizard({ connected, accountId, containerId, workspaceId, campaigns }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [funnelPages, setFunnelPages] = useState<FunnelPage[]>(() => [createNewPage()]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 5)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">GTM Setup</h1>
        <p className="text-sm text-gray-400 mt-0.5">Deploy tracking tags to Google Tag Manager in a few steps.</p>
      </div>

      <Stepper current={step} />

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
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
        {step === 3 && <Step3FunnelBuilder pages={funnelPages} setPages={setFunnelPages} onBack={back} onNext={next} />}
        {step === 4 && <Step4Review pages={funnelPages} onBack={back} onNext={next} />}
        {step === 5 && <Step5Deploy funnelPages={funnelPages} campaigns={campaigns} onBack={back} />}
      </div>
    </div>
  );
}
