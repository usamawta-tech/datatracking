"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EventRow = {
  id: string;
  type: string;
  url: string;
  path: string;
  title: string | null;
  element: string | null;
  referrer: string | null;
  createdAt: string;
};

interface Props {
  initialEvents: EventRow[];
  initialTotal: number;
}

const TYPE_META: Record<string, { icon: string; label: string; variant: "info" | "success" | "warning" }> = {
  page_view:        { icon: "👁️",  label: "Page view",        variant: "info" },
  button_click:     { icon: "🖱️",  label: "Button click",     variant: "success" },
  form_submit:      { icon: "📋",  label: "Form submit",      variant: "warning" },
  signup:           { icon: "✍️",  label: "Signup",           variant: "success" },
  login:            { icon: "🔑",  label: "Login",            variant: "info" },
  checkout_started: { icon: "🛒",  label: "Checkout started", variant: "warning" },
  purchase:         { icon: "💳",  label: "Purchase",         variant: "success" },
  scroll_depth:     { icon: "📜",  label: "Scroll depth",     variant: "info" },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function EventFeed({ initialEvents, initialTotal }: Props) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [live, setLive] = useState(true);
  const [clearing, setClearing] = useState(false);
  const newestId = useRef(initialEvents[0]?.id ?? "");

  useEffect(() => {
    if (!live) return;
    const id = setInterval(async () => {
      const res = await fetch("/api/events?limit=50");
      const data = await res.json();
      if (!data.events?.length) return;
      if (data.events[0].id !== newestId.current) {
        newestId.current = data.events[0].id;
        setEvents(data.events);
        setTotal(data.total);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [live]);

  async function clearAll() {
    setClearing(true);
    await fetch("/api/events", { method: "DELETE" });
    setEvents([]);
    setTotal(0);
    newestId.current = "";
    setClearing(false);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Events</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} total event{total !== 1 ? "s" : ""} from your tracking script
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLive((v) => !v)}
            className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
              live
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${live ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            {live ? "Live" : "Paused"}
          </button>
          <Button variant="secondary" size="sm" onClick={clearAll} loading={clearing}>
            Clear all
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="text-4xl mb-4">📡</div>
            <div className="text-gray-600 font-medium">No events yet</div>
            <div className="text-gray-400 text-sm mt-2">
              Install the tracking script on your website to start seeing events here.
            </div>
            <a href="/install" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
              → Go to Install Script
            </a>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Event stream</CardTitle>
                <CardDescription>Most recent 50 events, newest first</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {events.map((e) => {
                const meta = TYPE_META[e.type] ?? { icon: "•", label: e.type, variant: "info" as const };
                let elementInfo = "";
                if (e.element) {
                  try {
                    const el = JSON.parse(e.element);
                    if (el.text) elementInfo = `"${el.text}"`;
                    else if (el.id) elementInfo = `#${el.id}`;
                    else if (el.action) elementInfo = el.action;
                  } catch { /* ignore */ }
                }
                return (
                  <div key={e.id} className="flex items-start gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-lg mt-0.5">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <span className="text-sm font-medium text-gray-800 truncate">{e.path}</span>
                        {elementInfo && (
                          <span className="text-xs text-gray-400 truncate">{elementInfo}</span>
                        )}
                      </div>
                      {e.title && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{e.title}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 shrink-0 mt-1">{fmt(e.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-detect suggestion */}
      {events.length >= 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected pages</CardTitle>
            <CardDescription>Unique paths seen — use these to build funnel steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[...new Set(events.filter((e) => e.type === "pageview").map((e) => e.path))]
                .slice(0, 15)
                .map((path) => (
                  <div key={path} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700 font-mono">{path}</span>
                    <a
                      href={`/gtm?step=${encodeURIComponent(path)}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Add to funnel
                    </a>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
