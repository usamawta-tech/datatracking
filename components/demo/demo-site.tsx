"use client";
import { useEffect } from "react";

interface Props {
  siteKey: string;
  appUrl: string;
}

export function DemoSite({ siteKey, appUrl }: Props) {
  const collectUrl = `${appUrl}/api/collect`;

  useEffect(() => {
    if (document.getElementById("ait-tracker")) return;
    const script = document.createElement("script");
    script.id = "ait-tracker";
    script.innerHTML = `
(function(w,d){
'use strict';
var KEY=${JSON.stringify(siteKey)};
var API=${JSON.stringify(collectUrl)};
function getId(k,p){try{var v=localStorage.getItem(k);if(!v){v=p+'_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(k,v);}return v;}catch(e){return p+'_'+Math.random().toString(36).slice(2);}}
var DID=getId('_ait_uid','usr');
var SID=getId('_ait_sid','ses');
w.dataLayer=w.dataLayer||[];
function send(name,props){
  var data=Object.assign({event:name,page:w.location.pathname,page_title:d.title,page_url:w.location.href,referrer:d.referrer||'',distinct_id:DID,session_id:SID,timestamp:Date.now()},props);
  w.dataLayer.push(Object.assign({},data));
  var payload=JSON.stringify(Object.assign({key:KEY},data));
  try{if(navigator.sendBeacon){navigator.sendBeacon(API,new Blob([payload],{type:'application/json'}));}else{fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:true});}}catch(e){}
}
send('page_view',{});
var KW={purchase:/\\b(complete purchase|pay now|submit order|confirm payment|buy now)\\b/i,checkout:/\\b(checkout|place order|proceed to checkout)\\b/i,signup:/\\b(sign up|create account|get started|register|try free)\\b/i,login:/\\b(sign in|login|log in)\\b/i};
function classify(t,id,cls){var s=(t+' '+id+' '+cls).toLowerCase();if(KW.purchase.test(s))return 'purchase';if(KW.checkout.test(s))return 'checkout_started';if(KW.signup.test(s))return 'signup';if(KW.login.test(s))return 'login';return null;}
d.addEventListener('click',function(e){var el=e.target.closest('button,[type="button"],[type="submit"],a[href],[role="button"]');if(!el)return;var t=(el.innerText||el.value||'').trim().slice(0,120);send(classify(t,el.id||'',(el.className||'').toString())||'button_click',{button_text:t||undefined,button_id:el.id||undefined,href:el.href||undefined});},true);
d.addEventListener('submit',function(e){var f=e.target;var hasPwd=!!f.querySelector('[type="password"]');var hasEmail=!!f.querySelector('[type="email"],[name*="email"]');var fi=(f.id||f.name||'').toLowerCase();var name='form_submit';if(hasPwd&&hasEmail){name=/signup|register|join|create/.test(fi)?'signup':'login';}send(name,{form_id:f.id||undefined,form_action:f.action||undefined});},true);
var ss={};function chk(){var p=Math.round((w.scrollY+w.innerHeight)/Math.max(d.documentElement.scrollHeight,1)*100);[25,50,75,100].forEach(function(m){if(!ss[m]&&p>=m){ss[m]=true;send('scroll_depth',{scroll_percent:m});}});}
w.addEventListener('scroll',chk,{passive:true});
})(window,document);`;
    document.head.appendChild(script);
  }, [siteKey, collectUrl]);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-lg">John Carter</span>
          <nav className="flex items-center gap-6 text-sm text-gray-600">
            <a href="#about" className="hover:text-gray-900 transition-colors">About</a>
            <a href="#projects" className="hover:text-gray-900 transition-colors">Projects</a>
            <a href="#contact" className="hover:text-gray-900 transition-colors">Contact</a>
            <a
              href="#contact"
              className="bg-gray-900 text-white px-4 py-1.5 rounded-full text-sm hover:bg-gray-700 transition-colors"
            >
              Hire Me
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 max-w-4xl mx-auto">
        <p className="text-blue-600 font-medium mb-3 text-sm uppercase tracking-widest">Full Stack Developer</p>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Hi, I&apos;m John.<br />I build things for the web.
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mb-8">
          I&apos;m a developer based in New York specializing in building clean, fast, and user-friendly web applications.
        </p>
        <div className="flex gap-4">
          <a
            href="#projects"
            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            View My Work
          </a>
          <a
            href="#contact"
            className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Get In Touch
          </a>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-2">About Me</h2>
          <div className="w-10 h-1 bg-blue-600 mb-8 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="w-full aspect-square bg-gray-200 rounded-2xl flex items-center justify-center text-gray-400 text-6xl">
              👤
            </div>
            <div>
              <p className="text-gray-600 mb-4 leading-relaxed">
                I have 5 years of experience building web applications with React, Next.js, and Node.js. I care deeply about performance, accessibility, and writing maintainable code.
              </p>
              <p className="text-gray-600 mb-6 leading-relaxed">
                When I&apos;m not coding, I write about web development, contribute to open source, and mentor junior developers.
              </p>
              <div className="flex flex-wrap gap-2">
                {["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL", "Tailwind CSS"].map((skill) => (
                  <span key={skill} className="bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
                    {skill}
                  </span>
                ))}
              </div>
              <button className="mt-6 text-blue-600 font-medium text-sm hover:underline">
                Download Resume
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-2">Projects</h2>
          <div className="w-10 h-1 bg-blue-600 mb-8 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Task Manager App",
                desc: "A full-stack productivity app with real-time collaboration, built with Next.js and Supabase.",
                tags: ["Next.js", "Supabase", "TypeScript"],
                color: "bg-blue-50",
              },
              {
                title: "Dev Blog Platform",
                desc: "A Markdown-powered blog platform with syntax highlighting and SEO optimization.",
                tags: ["React", "MDX", "Tailwind"],
                color: "bg-purple-50",
              },
              {
                title: "Weather Dashboard",
                desc: "A clean weather app using OpenWeather API with charts and 7-day forecasts.",
                tags: ["React", "Recharts", "API"],
                color: "bg-green-50",
              },
            ].map((p) => (
              <div key={p.title} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                <div className={`${p.color} h-32 flex items-center justify-center text-4xl`}>💻</div>
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-2">{p.title}</h3>
                  <p className="text-gray-500 text-sm mb-3 leading-relaxed">{p.desc}</p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {p.tags.map((t) => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button className="text-xs text-blue-600 font-medium hover:underline">Live Demo</button>
                    <button className="text-xs text-gray-500 font-medium hover:underline">GitHub</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-2">Get In Touch</h2>
          <div className="w-10 h-1 bg-blue-600 mb-8 rounded" />
          <div className="max-w-lg">
            <p className="text-gray-500 mb-8">
              Have a project in mind or want to work together? Send me a message and I&apos;ll get back to you within 24 hours.
            </p>
            <form id="contact-form" onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  rows={4}
                  placeholder="Tell me about your project..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-sm text-gray-400">
          <span>John Carter &copy; 2026</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-gray-600 transition-colors">GitHub</a>
            <a href="#" className="hover:text-gray-600 transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
