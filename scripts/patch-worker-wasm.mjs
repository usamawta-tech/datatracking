// Runs AFTER opennextjs-cloudflare build.
// Adds a static WebAssembly module import to worker.js and rewrites the
// Prisma Wasm loader to use it — static imports are the ONLY way to use
// Wasm in Cloudflare Workers (dynamic compilation is fully blocked).
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";

const WASM_SRC  = "prisma/sqlite_query_compiler.wasm";
const WASM_DEST = ".open-next/sqlite_query_compiler.wasm";
const WORKER    = ".open-next/worker.js";

if (!existsSync(WORKER)) {
  console.error("[patch-worker-wasm] worker.js not found — run opennextjs-cloudflare build first");
  process.exit(1);
}

// ── 1. Copy .wasm next to worker.js ──────────────────────────────────────
copyFileSync(WASM_SRC, WASM_DEST);
console.log("[patch-worker-wasm] Copied", WASM_SRC, "→", WASM_DEST);

// ── 2. Load worker bundle ─────────────────────────────────────────────────
let worker = readFileSync(WORKER, "utf8");

if (worker.includes("__prisma_sqlite_wasm")) {
  console.log("[patch-worker-wasm] Already patched, skipping.");
  process.exit(0);
}

// ── 3. Add static import at the top ──────────────────────────────────────
// Wrangler processes this as a CompiledWasm module (see wrangler.jsonc rules).
worker = `import __prisma_sqlite_wasm from './sqlite_query_compiler.wasm';\n` + worker;

// ── 4. Replace decodeBase64AsWasm using bracket counting ──────────────────
// Bracket counting reliably finds the full function body regardless of nesting.
function extractAndReplace(src, searchStr, replacement) {
  const start = src.indexOf(searchStr);
  if (start === -1) return null;

  // Find the opening brace of the function/block
  const braceOpen = src.indexOf("{", start);
  if (braceOpen === -1) return null;

  // Count braces to find the matching closing brace
  let depth = 0;
  let end = -1;
  for (let i = braceOpen; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) return null;

  return src.slice(0, start) + replacement + src.slice(end);
}

// Primary: replace the full decodeBase64AsWasm function
let patched = extractAndReplace(
  worker,
  "async function decodeBase64AsWasm(",
  "async function decodeBase64AsWasm(_b64) { return __prisma_sqlite_wasm; }"
);

if (patched) {
  worker = patched;
  console.log("[patch-worker-wasm] Replaced decodeBase64AsWasm with static Wasm reference");
} else {
  // Fallback: also try replacing the getQueryCompilerWasmModule async arrow callback
  patched = extractAndReplace(
    worker,
    "getQueryCompilerWasmModule:async",
    "getQueryCompilerWasmModule:async()=>__prisma_sqlite_wasm,__x:"
  );
  if (patched) {
    // Clean up the dummy __x: we added to help bracket counting end correctly
    worker = patched.replace(",__x:", "");
    console.log("[patch-worker-wasm] Replaced getQueryCompilerWasmModule callback");
  } else {
    console.warn("[patch-worker-wasm] WARNING: Could not find Prisma Wasm target in worker.js");
    console.warn("[patch-worker-wasm] The static import was added but Prisma may still use dynamic Wasm");
  }
}

// ── 5. Write patched worker ───────────────────────────────────────────────
writeFileSync(WORKER, worker, "utf8");
console.log("[patch-worker-wasm] Done.");
