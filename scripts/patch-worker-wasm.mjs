// Runs AFTER opennextjs-cloudflare build.
// Modifies the generated worker.js to use a static WebAssembly module import
// instead of dynamic Wasm compilation, which is fully blocked in Cloudflare Workers.
// Wrangler processes the static import via the CompiledWasm rule in wrangler.jsonc.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";

const WASM_SRC  = "prisma/sqlite_query_compiler.wasm";
const WASM_DEST = ".open-next/sqlite_query_compiler.wasm";
const WORKER    = ".open-next/worker.js";

if (!existsSync(WORKER)) {
  console.error("[patch-worker-wasm] worker.js not found — run opennextjs-cloudflare build first");
  process.exit(1);
}

// ── 1. Copy the .wasm file next to worker.js ──────────────────────────────
copyFileSync(WASM_SRC, WASM_DEST);
console.log("[patch-worker-wasm] Copied", WASM_SRC, "→", WASM_DEST);

// ── 2. Patch worker.js ───────────────────────────────────────────────────
let worker = readFileSync(WORKER, "utf8");

// Add static import at the very top — wrangler treats this as CompiledWasm
const STATIC_IMPORT = `import __prisma_sqlite_wasm from './sqlite_query_compiler.wasm';\n`;
if (!worker.includes("__prisma_sqlite_wasm")) {
  worker = STATIC_IMPORT + worker;
}

// Replace the decodeBase64AsWasm function to return the pre-compiled module.
// The function is defined in the bundle as-is from our class.ts patch.
const fnPattern = /async function decodeBase64AsWasm\([^)]*\)\s*\{[\s\S]*?\n\}/;
const fnReplacement = `async function decodeBase64AsWasm(_wasmBase64) { return __prisma_sqlite_wasm; }`;

if (fnPattern.test(worker)) {
  worker = worker.replace(fnPattern, fnReplacement);
  console.log("[patch-worker-wasm] Replaced decodeBase64AsWasm with static Wasm reference");
} else {
  console.warn("[patch-worker-wasm] WARNING: decodeBase64AsWasm not found in worker.js — pattern may have changed");
}

writeFileSync(WORKER, worker, "utf8");
console.log("[patch-worker-wasm] Done patching worker.js");
