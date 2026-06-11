"use client";
import { useState } from "react";
import Link from "next/link";

interface Tag {
  id: string;
  name: string;
  tagType: string;
  status: string;
  createdAt: string;
}

const PAGE_SIZE = 10;

const TAG_TYPE_DISPLAY: Record<string, { label: string; color: string }> = {
  mixpanel:   { label: "Mixpanel",   color: "bg-purple-100 text-purple-700" },
  auto_event: { label: "Mixpanel",   color: "bg-purple-100 text-purple-700" },
  ga4:        { label: "GA4",        color: "bg-orange-100 text-orange-700" },
  google_ads: { label: "Google Ads", color: "bg-blue-100 text-blue-700" },
  meta:       { label: "Meta",       color: "bg-sky-100 text-sky-700" },
};

const STATUS_COLORS: Record<string, string> = {
  published: "bg-green-100 text-green-700",
  failed:    "bg-red-100 text-red-700",
  pending:   "bg-amber-100 text-amber-700",
  draft:     "bg-gray-100 text-gray-600",
};

export function TagsCard({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags]               = useState(initialTags);
  const [page, setPage]               = useState(0);
  const [editId, setEditId]           = useState<string | null>(null);
  const [editName, setEditName]       = useState("");
  const [savingId, setSavingId]       = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  const mixpanelCount = tags.filter((t) => t.tagType === "mixpanel" || t.tagType === "auto_event").length;
  const otherCount    = tags.filter((t) => t.tagType !== "mixpanel" && t.tagType !== "auto_event").length;
  const totalPages    = Math.ceil(tags.length / PAGE_SIZE);
  const pageTags      = tags.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function startEdit(tag: Tag) {
    setEditId(tag.id);
    setEditName(tag.name);
    setConfirmDelId(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setSavingId(id);
    const res = await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setTags((prev) => prev.map((t) => (t.id === id ? { ...t, name: data.tag.name } : t)));
      cancelEdit();
    }
    setSavingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTags((prev) => {
        const next = prev.filter((t) => t.id !== id);
        setPage((p) => Math.min(p, Math.max(0, Math.ceil(next.length / PAGE_SIZE) - 1)));
        return next;
      });
    }
    setConfirmDelId(null);
    setDeletingId(null);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Generated Tags</h2>
          <p className="text-xs text-gray-400 mt-0.5">{mixpanelCount} Mixpanel · {otherCount} other</p>
        </div>
        <Link
          href="/gtm"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          + New campaign
        </Link>
      </div>

      {/* Body */}
      {tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">No tags yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Go to GTM Setup to define a funnel and deploy your first tags.</p>
          <Link
            href="/gtm"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
          >
            Go to GTM Setup →
          </Link>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {pageTags.map((t) => {
              const display      = TAG_TYPE_DISPLAY[t.tagType] ?? { label: "Custom", color: "bg-gray-100 text-gray-600" };
              const isEditing    = editId === t.id;
              const isSaving     = savingId === t.id;
              const isConfirming = confirmDelId === t.id;
              const isDeleting   = deletingId === t.id;

              return (
                <div key={t.id} className="flex items-center gap-3 px-6 py-3 group">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-semibold shrink-0 ${display.color}`}>
                    {display.label}
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        autoFocus
                        className="flex-1 text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(t.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        onClick={() => handleSaveEdit(t.id)}
                        disabled={isSaving}
                        className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : isConfirming ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm text-gray-700 font-medium truncate flex-1 min-w-0">{t.name}</span>
                      <span className="text-xs text-red-600 font-medium shrink-0">Delete this tag?</span>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={isDeleting}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmDelId(null)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-gray-800 font-medium truncate flex-1 min-w-0">{t.name}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t.status}
                      </span>
                      {/* Action buttons — visible on hover */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(t)}
                          title="Rename tag"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { setConfirmDelId(t.id); setEditId(null); }}
                          title="Delete tag"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-400">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, tags.length)} of {tags.length} tags
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-500 px-2 font-medium">{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
