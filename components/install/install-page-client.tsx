"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  siteKey: string;
  appUrl: string;
  initialEventCount: number;
}

export function InstallPageClient({ siteKey, appUrl, initialEventCount }: Props) {
  const [copied, setCopied] = useState(false);
  const [eventCount, setEventCount] = useState(initialEventCount);

  const collectUrl = `${appUrl}/api/collect`;

  // Inline snippet (same logic as tracker route but displayed for copy)
  const snippet = `<!-- AI Tracker — paste once inside <head> -->
<script>
(function(w,d){
'use strict';
var KEY=${JSON.stringify(siteKey)};
var API=${JSON.stringify(collectUrl)};
function getId(k,p){try{var v=localStorage.getItem(k);if(!v){v=p+'_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,v);}return v;}catch(e){return p+'_'+Math.random().toString(36).slice(2);}}
var DID=getId('_ait_uid','usr');
var SID=getId('_ait_sid','ses');
w.dataLayer=w.dataLayer||[];
function send(name,props){
  var d=Object.assign({event:name,page:w.location.pathname,page_title:d&&d.title||document.title,page_url:w.location.href,referrer:document.referrer||'',distinct_id:DID,session_id:SID,timestamp:Date.now()},props);
  w.dataLayer.push(Object.assign({},d));
  var p=JSON.stringify(Object.assign({key:KEY},d));
  try{if(navigator.sendBeacon){navigator.sendBeacon(API,new Blob([p],{type:'application/json'}));}else{fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:p,keepalive:true});}}catch(e){}
}
send('page_view',{});
var KW={purchase:/\\b(complete purchase|pay now|submit order|confirm payment|buy now)\\b/i,checkout:/\\b(checkout|place order|proceed to checkout)\\b/i,signup:/\\b(sign up|create account|get started|register|try free)\\b/i,login:/\\b(sign in|login|log in)\\b/i};
function classify(t,id,cls){var s=(t+' '+id+' '+cls).toLowerCase();if(KW.purchase.test(s))return 'purchase';if(KW.checkout.test(s))return 'checkout_started';if(KW.signup.test(s))return 'signup';if(KW.login.test(s))return 'login';return null;}
d.addEventListener('click',function(e){var el=e.target.closest('button,[type="button"],[type="submit"],a[href],[role="button"]');if(!el)return;var t=(el.innerText||el.value||'').trim().slice(0,120);send(classify(t,el.id||'',(el.className||'').toString())||'button_click',{button_text:t||undefined,button_id:el.id||undefined,href:el.href||undefined});},true);
d.addEventListener('submit',function(e){var f=e.target;var hasPwd=!!f.querySelector('[type="password"]');var hasEmail=!!f.querySelector('[type="email"],[name*="email"]');var a=(f.action||'').toLowerCase();var fi=(f.id||f.name||'').toLowerCase();var name='form_submit';if(hasPwd&&hasEmail){name=/signup|register|join|create/.test(a+fi)?'signup':'login';}else if(/checkout|order|pay/.test(a+fi)){name='checkout_started';}send(name,{form_id:f.id||undefined,form_action:f.action||undefined});},true);
var ss={};function chk(){var p=Math.round((w.scrollY+w.innerHeight)/Math.max(d.documentElement.scrollHeight,1)*100);[25,50,75,100].forEach(function(m){if(!ss[m]&&p>=m){ss[m]=true;send('scroll_depth',{scroll_percent:m});}});}
w.addEventListener('scroll',chk,{passive:true});
})(window,document);
</script>`;

  function copy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Live check every 5s
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch("/api/events?limit=1");
      const data = await res.json();
      if (typeof data.total === "number") setEventCount(data.total);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const installed = eventCount > 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Install Script</h1>
          <p className="text-gray-500 text-sm mt-1">
            One snippet. Auto-detects page views, clicks, forms, checkout, scroll depth.
          </p>
        </div>
        <Badge variant={installed ? "success" : "warning"}>
          {installed ? `✓ Active — ${eventCount} events` : "Waiting for events…"}
        </Badge>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { n: 1, title: "Copy snippet",    desc: "Click \"Copy\" below to get your unique script." },
          { n: 2, title: "Paste in <head>", desc: "Add it once to every page — before </head>." },
          { n: 3, title: "Events flow in",  desc: "Visit your site. Events appear in the Live Events page instantly." },
        ].map((s) => (
          <div key={s.n} className="bg-white rounded-xl border border-gray-200 p-5 flex gap-4">
            <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{s.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Script */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Tracking Snippet</CardTitle>
              <CardDescription>Unique to your account — keep it private</CardDescription>
            </div>
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? "✓ Copied!" : "Copy snippet"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-950 text-green-300 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64">
            {snippet}
          </pre>
        </CardContent>
      </Card>

      {/* Events detected */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-detected events</CardTitle>
          <CardDescription>What the script captures automatically</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: "👁️", event: "page_view",         desc: "Every page load" },
              { icon: "🖱️", event: "button_click",       desc: "Buttons & links" },
              { icon: "📋", event: "form_submit",        desc: "Any form submit" },
              { icon: "✍️", event: "signup",             desc: "Registration forms" },
              { icon: "🔑", event: "login",              desc: "Login forms" },
              { icon: "🛒", event: "checkout_started",   desc: "Checkout buttons" },
              { icon: "💳", event: "purchase",           desc: "Buy/pay buttons" },
              { icon: "📜", event: "scroll_depth",       desc: "25/50/75/100%" },
            ].map((e) => (
              <div key={e.event} className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg mb-1">{e.icon}</div>
                <div className="text-xs font-mono font-semibold text-gray-700">{e.event}</div>
                <div className="text-xs text-gray-400 mt-0.5">{e.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* What happens automatically */}
      <Card>
        <CardHeader>
          <CardTitle>What happens automatically</CardTitle>
          <CardDescription>After the script is installed — zero manual work needed</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-gray-600">
            {[
              "Script detects an event (e.g. checkout_started) and pushes it to window.dataLayer",
              "Event is sent to this app's backend API in real time",
              "Backend immediately forwards the event to Mixpanel server-side",
              "If GTM is connected, a Custom Event trigger + Mixpanel tag is auto-created in GTM",
              "GTM workspace is published automatically — the tag goes live within seconds",
              "You see the event in the Live Events feed here",
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

      {installed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
          <span className="text-green-500 text-2xl">✓</span>
          <div>
            <div className="font-semibold text-green-800">Script is working</div>
            <div className="text-sm text-green-700 mt-0.5">
              {eventCount} event{eventCount !== 1 ? "s" : ""} received.{" "}
              <a href="/events" className="underline font-medium">View live feed →</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
