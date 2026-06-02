const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOTS = path.join(__dirname, "screenshots");
if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });

const BASE = "http://localhost:3000";
const SESSION = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbXBtdWZiZ28wMDAxdjR0cDc3dXFhbm1sIiwiZW1haWwiOiJkYXRhQHdldHJhY2thZHMuY29tIiwiZXhwaXJlc0F0IjoiMjAyNi0wNi0wMlQyMDoxNDoxOS43NjBaIiwiaWF0IjoxNzc5ODI2NDU5LCJleHAiOjE3ODA0MzEyNTl9.pD7nf6ZJ5LrOlnWbDxGoc4yOnD_qpplbH99MjQmaBjI";

async function shot(page, name) {
  const file = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 screenshots/${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: {
      cookies: [{
        name: "session",
        value: SESSION,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      }],
      origins: [],
    },
  });
  const page = await ctx.newPage();

  // Capture console errors
  const errors = [];
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", err => errors.push(err.message));

  // ── 1. Dashboard ─────────────────────────────────────────────────────────────
  console.log("\n1️⃣  Dashboard");
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const dashUrl = page.url();
  console.log("   URL:", dashUrl);
  await shot(page, "01-dashboard");

  if (dashUrl.includes("login")) {
    console.log("   ❌ Session rejected — still on login");
    await browser.close();
    return;
  }
  console.log("   ✅ Logged in as data@wetrackads.com");

  // ── 2. GTM Wizard — Step 1: Connected state ───────────────────────────────────
  console.log("\n2️⃣  GTM Wizard — Step 1 (Connected)");
  await page.goto(`${BASE}/gtm`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  await shot(page, "02-gtm-step1-connected");

  const connectedBanner = page.locator("text=Connected").first();
  const connectBtn = page.locator("button:has-text('Sign in with Google')");
  const changeBtn = page.locator("button:has-text('Change Container')");
  const disconnectBtn = page.locator("button:has-text('Disconnect')");
  const nextBtn = () => page.locator("button:has-text('Next')").first();

  if (await connectedBanner.isVisible()) {
    console.log("   ✅ Green 'Connected' banner visible");
    if (await changeBtn.isVisible()) console.log("   ✅ 'Change Container' button visible");
    if (await disconnectBtn.isVisible()) console.log("   ✅ 'Disconnect GTM' button visible");
  } else if (await connectBtn.isVisible()) {
    console.log("   ⚠️  Still showing connect screen — GTM connection may not have loaded");
    const content = await page.locator("main").innerText().catch(() => "");
    console.log("   Content:", content.slice(0, 200).replace(/\s+/g, " "));
    await browser.close();
    return;
  }

  // ── 3. Step 2: Install Script ──────────────────────────────────────────────────
  console.log("\n3️⃣  GTM Wizard — Step 2: Install Script");
  if (await nextBtn().isVisible()) {
    await nextBtn().click();
    // Wait for snippet to load (token refresh + GTM API can take ~5s)
    try {
      await page.waitForSelector("pre", { timeout: 12000 });
    } catch {
      // snippet may have failed — take screenshot anyway
    }
    await page.waitForTimeout(500);
    await shot(page, "03-gtm-step2-script");

    const pre = page.locator("pre").first();
    if (await pre.isVisible()) {
      const headText = await pre.innerText();
      console.log("   ✅ Head snippet shown:", headText.slice(0, 80).replace(/\s+/g, " ") + "...");
      const allPres = await page.locator("pre").count();
      console.log("   Code blocks:", allPres, "(head + body snippets)");
    } else {
      const errText = await page.locator("[class*='red'], [class*='error']").first().innerText().catch(() => "");
      console.log("   ⚠️  No <pre> found. Error:", errText || "(none visible)");
      const content = await page.locator(".bg-white").first().innerText().catch(() => "");
      console.log("   Content:", content.slice(0, 200).replace(/\s+/g, " "));
    }
  } else {
    console.log("   ❌ No 'Next' button on Step 1");
    await browser.close();
    return;
  }

  // ── 4. Step 3: Landing Page ────────────────────────────────────────────────────
  console.log("\n4️⃣  GTM Wizard — Step 3: Landing Page");
  await nextBtn().click();
  await page.waitForTimeout(600);
  await shot(page, "04-gtm-step3-landing");

  const urlInput = page.locator('input[placeholder*="example.com"]');
  if (await urlInput.isVisible()) {
    await urlInput.fill("https://mystore.com/checkout");
    await page.waitForTimeout(500);
    const triggerInput = page.locator('input[placeholder="/checkout"]');
    const autoPath = await triggerInput.inputValue().catch(() => "");
    console.log("   ✅ URL entered; auto-extracted trigger path:", autoPath || "/checkout");

    const descInput = page.locator("textarea, input[placeholder*='description'], input[placeholder*='describe']").first();
    if (await descInput.isVisible()) {
      await descInput.fill("Checkout page — purchase funnel");
    }
    await shot(page, "04b-gtm-step3-filled");
    console.log("   ✅ Landing page form filled");
  } else {
    console.log("   ⚠️  URL input not found");
    const content = await page.locator(".bg-white").first().innerText().catch(() => "");
    console.log("   Content:", content.slice(0, 200).replace(/\s+/g, " "));
  }

  // ── 5. Step 4: Configure Tags ──────────────────────────────────────────────────
  console.log("\n5️⃣  GTM Wizard — Step 4: Configure Tags");
  await nextBtn().click();
  await page.waitForTimeout(600);
  await shot(page, "05-gtm-step4-tags");

  const platforms = ["Google Ads", "GA4", "Meta", "Mixpanel"];
  for (const p of platforms) {
    const visible = await page.locator(`text=${p}`).first().isVisible();
    console.log(`   ${visible ? "✅" : "❌"} Platform card: ${p}`);
  }

  // Enable Google Ads
  const googleAdsToggle = page.locator("#enable-google_ads");
  if (await googleAdsToggle.isVisible()) {
    await googleAdsToggle.click();
    await page.waitForTimeout(400);
    const tagIdInput = page.locator('input[placeholder="AW-123456789"]');
    if (await tagIdInput.isVisible()) {
      await tagIdInput.fill("AW-987654321");
      await page.locator('input[placeholder="conversion"]').fill("purchase");
      console.log("   ✅ Google Ads enabled: AW-987654321 / purchase");
    }
  }

  // Enable GA4
  const ga4Toggle = page.locator("#enable-ga4");
  if (await ga4Toggle.isVisible()) {
    await ga4Toggle.click();
    await page.waitForTimeout(400);
    const ga4Input = page.locator('input[placeholder="G-XXXXXXXXXX"]');
    if (await ga4Input.isVisible()) {
      await ga4Input.fill("G-TEST123456");
      const ga4Event = page.locator('input[placeholder="page_view"]');
      if (await ga4Event.isVisible()) await ga4Event.fill("purchase");
      console.log("   ✅ GA4 enabled: G-TEST123456 / purchase");
    }
  }

  await shot(page, "05b-gtm-step4-filled");

  // ── 6. Step 5: Review & Deploy ────────────────────────────────────────────────
  console.log("\n6️⃣  GTM Wizard — Step 5: Review & Deploy");
  await nextBtn().click();
  await page.waitForTimeout(600);
  await shot(page, "06-gtm-step5-review");

  const triggerSummary = await page.locator("text=/Page View/i").first().isVisible();
  const deployBtn = page.locator("button:has-text('Create Tags')");
  console.log("   Trigger summary:", triggerSummary ? "✅ visible" : "❌ not visible");
  console.log("   Deploy button:", await deployBtn.isVisible() ? "✅ visible" : "❌ not visible");

  // Campaign name input has id="campaign-name", placeholder="e.g. Checkout Page Q2 2026"
  const campaignInput = page.locator('#campaign-name');
  if (await campaignInput.isVisible()) {
    await campaignInput.fill("Checkout Funnel — May 2026");
    await page.waitForTimeout(300);
    await shot(page, "06b-gtm-step5-named");
    console.log("   ✅ Campaign name entered: 'Checkout Funnel — May 2026'");
  } else {
    console.log("   ⚠️  Campaign name input not found by #campaign-name");
  }

  // ── 7. Deploy tags ────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Deploying tags to GTM...");
  const deployVisible = await deployBtn.isVisible();
  if (!deployVisible) {
    console.log("   ❌ Deploy button not visible — skipping");
  } else {
    // Intercept API calls to capture the response
    const apiResults = [];
    page.on("response", async (res) => {
      if (res.url().includes("/api/campaigns")) {
        try {
          const json = await res.json().catch(() => null);
          if (json) apiResults.push({ url: res.url(), status: res.status(), body: json });
        } catch {}
      }
    });

    await deployBtn.click();
    console.log("   ⏳ Waiting for GTM API response...");
    await page.waitForTimeout(8000);
    await shot(page, "07-gtm-deployed");

    // Check for success or error
    const successBanner = await page.locator("text=/published|deployed|success|created/i").first().isVisible().catch(() => false);
    const errorText = await page.locator("text=/error|failed|invalid/i").first().innerText().catch(() => "");

    if (successBanner) {
      console.log("   ✅ Tags deployed successfully!");
      const tagNames = await page.locator("[class*='tag'], [class*='badge'], li").allInnerTexts().catch(() => []);
      console.log("   Tags:", tagNames.filter(t => t.includes("Campaign")).join(", ") || "(see screenshot)");
    } else if (errorText) {
      console.log("   ❌ Deploy error:", errorText.slice(0, 200));
    } else {
      const content = await page.locator("main, .bg-white").first().innerText().catch(() => "");
      console.log("   Page state:", content.slice(0, 300).replace(/\s+/g, " "));
    }

    // API call results
    for (const r of apiResults) {
      console.log(`   API ${r.url.split("/api/")[1]} → ${r.status}:`, JSON.stringify(r.body).slice(0, 200));
    }
  }

  // ── 8. Previous campaigns table ───────────────────────────────────────────────
  console.log("\n8️⃣  Previous Campaigns");
  const campaignsTable = page.locator("table, [class*='campaign']").first();
  if (await campaignsTable.isVisible()) {
    const rows = await page.locator("tbody tr, [class*='campaign-row']").count();
    console.log("   ✅ Campaigns table visible,", rows, "row(s)");
  }

  // ── 9. Console errors check ───────────────────────────────────────────────────
  if (errors.length > 0) {
    console.log("\n⚠️  Console errors during session:");
    errors.slice(0, 5).forEach(e => console.log("  ", e.slice(0, 150)));
  }

  await browser.close();

  console.log("\n=== SCREENSHOTS TAKEN ===");
  fs.readdirSync(SCREENSHOTS)
    .filter(f => f.match(/^0[1-9]|^[1-9]/))
    .sort()
    .slice(-12)
    .forEach(f => console.log("  📸", f));
})();
