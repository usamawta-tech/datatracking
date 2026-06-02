import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { siteKey: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const collectUrl = `${appUrl}/api/collect`;

  // Comprehensive auto-tracking script
  const script = `<!-- AI Tracker by WeTrackAds — auto-detects all user interactions -->
<script>
(function(w,d){
'use strict';

var KEY=${JSON.stringify(user.siteKey)};
var API=${JSON.stringify(collectUrl)};

// ── Persistent IDs stored in localStorage ──────────────────────────────────
function getId(k,prefix){
  try{
    var v=localStorage.getItem(k);
    if(!v){v=prefix+'_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,v);}
    return v;
  }catch(e){return prefix+'_'+Math.random().toString(36).slice(2);}
}
var DISTINCT_ID=getId('_ait_uid','usr');
var SESSION_ID=getId('_ait_sid','ses');

// ── dataLayer ──────────────────────────────────────────────────────────────
w.dataLayer=w.dataLayer||[];

// ── Send event ─────────────────────────────────────────────────────────────
function send(eventName,props){
  var data=Object.assign({
    event:eventName,
    page:w.location.pathname,
    page_title:d.title,
    page_url:w.location.href,
    referrer:d.referrer||'',
    distinct_id:DISTINCT_ID,
    session_id:SESSION_ID,
    timestamp:Date.now()
  },props);

  // 1. Push into GTM dataLayer
  w.dataLayer.push(Object.assign({},data));

  // 2. Send to backend
  var payload=JSON.stringify(Object.assign({key:KEY},data));
  try{
    if(navigator.sendBeacon){navigator.sendBeacon(API,new Blob([payload],{type:'application/json'}));}
    else{fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true});}
  }catch(e){}
}

// ── Page view ──────────────────────────────────────────────────────────────
send('page_view',{});

// ── Semantic keyword maps ──────────────────────────────────────────────────
var KW={
  purchase:/\b(complete purchase|finish purchase|pay now|submit order|confirm payment|buy now)\b/i,
  checkout:/\b(checkout|proceed to checkout|go to checkout|start checkout|place order|review order)\b/i,
  signup:/\b(sign up|signup|create account|get started|join free|register|try free|start free)\b/i,
  login:/\b(sign in|login|log in|continue with|access account)\b/i
};

function classifyText(text,id,cls,action){
  var s=(text+' '+id+' '+cls+' '+(action||'')).toLowerCase();
  if(KW.purchase.test(s)) return 'purchase';
  if(KW.checkout.test(s)) return 'checkout_started';
  if(KW.signup.test(s))   return 'signup';
  if(KW.login.test(s))    return 'login';
  return null;
}

// ── Click tracking ─────────────────────────────────────────────────────────
d.addEventListener('click',function(e){
  var el=e.target.closest('button,[type="button"],[type="submit"],a[href],[role="button"]');
  if(!el) return;

  var text=(el.innerText||el.value||el.getAttribute('aria-label')||'').trim().slice(0,120);
  var id=el.id||'';
  var cls=(el.className||'').toString().slice(0,100);
  var href=el.href||'';

  var semantic=classifyText(text,id,cls,'');
  var eventName=semantic||'button_click';

  send(eventName,{
    button_text:text||undefined,
    button_id:id||undefined,
    button_class:cls||undefined,
    href:href||undefined
  });
},true);

// ── Form submission ────────────────────────────────────────────────────────
d.addEventListener('submit',function(e){
  var form=e.target;
  var hasPwd=!!form.querySelector('[type="password"]');
  var hasEmail=!!form.querySelector('[type="email"],[name*="email"],[name*="Email"]');
  var action=(form.action||'').toLowerCase();
  var fid=(form.id||form.name||'').toLowerCase();
  var combined=action+' '+fid;

  var eventName='form_submit';
  if(hasPwd&&hasEmail){
    eventName=/signup|register|join|create/.test(combined)?'signup':'login';
  } else if(/checkout|order|payment|pay/.test(combined)){
    eventName='checkout_started';
  }

  send(eventName,{
    form_id:form.id||undefined,
    form_action:form.action||undefined
  });
},true);

// ── Scroll depth (25 / 50 / 75 / 100) ────────────────────────────────────
var scrollSent={};
function onScroll(){
  var pct=Math.round((w.scrollY+w.innerHeight)/Math.max(d.documentElement.scrollHeight,1)*100);
  [25,50,75,100].forEach(function(mark){
    if(!scrollSent[mark]&&pct>=mark){
      scrollSent[mark]=true;
      send('scroll_depth',{scroll_percent:mark});
    }
  });
}
w.addEventListener('scroll',onScroll,{passive:true});

})(window,document);
</script>`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
