// Refines Prisma's generated class.ts for Cloudflare Workers (free tier).
//
// Two optimizations:
//  1. Switch from the `fast` query-compiler Wasm (~3.4 MB) to the `small`
//     variant (~1.7 MB). Same functionality, half the size.
//  2. In production (CF Workers), return the statically-imported Wasm module
//     from globalThis.__prisma_sqlite_wasm (set by worker.js) and let esbuild
//     tree-shake the giant base64 string out of the bundle. The dev path keeps
//     using new WebAssembly.Module(buffer), which Node allows.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ── 1. Extract the SMALL sqlite Wasm binary to static files ───────────────
const smallBase64File = path.join(
  root,
  "node_modules/@prisma/client/runtime/query_compiler_small_bg.sqlite.wasm-base64.mjs"
);
const wasmTargets = [
  path.join(root, "public/_prisma/sqlite_query_compiler.wasm"),
  path.join(root, "prisma/sqlite_query_compiler.wasm"),
];

let wasmBuf = null;
for (const dest of wasmTargets) {
  // Always regenerate to ensure it matches the small variant
  if (!wasmBuf) {
    const src = readFileSync(smallBase64File, "utf8");
    const match = src.match(/const wasm = "([^"]+)"/);
    if (!match) throw new Error("[patch-prisma-wasm] Could not find base64 wasm string");
    wasmBuf = Buffer.from(match[1], "base64");
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, wasmBuf);
}
console.log(`[patch-prisma-wasm] Wrote small sqlite Wasm (${wasmBuf.length} bytes) to static files`);

// ── 2. Patch generated class.ts ───────────────────────────────────────────
const classFile = path.join(root, "app/generated/prisma/internal/class.ts");
let src = readFileSync(classFile, "utf8");

if (src.includes("__prisma_sqlite_wasm")) {
  console.log("[patch-prisma-wasm] Already patched, skipping.");
  process.exit(0);
}

if (!src.includes("query_compiler_fast_bg")) {
  console.warn("[patch-prisma-wasm] WARNING: expected query_compiler_fast_bg not found — Prisma may have changed.");
  process.exit(0);
}

// 2a. Switch every fast → small (getRuntime, base64 import, importName)
src = src.split("query_compiler_fast_bg").join("query_compiler_small_bg");

// 2b. Short-circuit getQueryCompilerWasmModule in production to the static module.
//     The base64 import below the guard becomes dead code (NODE_ENV is inlined
//     to "production" by esbuild) and is tree-shaken out.
const before = `  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_small_bg.sqlite.wasm-base64.mjs")
    return await decodeBase64AsWasm(wasm)
  },`;

const after = `  getQueryCompilerWasmModule: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (process.env.NODE_ENV === 'production') return (globalThis as any).__prisma_sqlite_wasm;
    const { wasm } = await import("@prisma/client/runtime/query_compiler_small_bg.sqlite.wasm-base64.mjs")
    return await decodeBase64AsWasm(wasm)
  },`;

if (!src.includes(before)) {
  console.warn("[patch-prisma-wasm] WARNING: getQueryCompilerWasmModule block not found in expected shape.");
  writeFileSync(classFile, src, "utf8");
  process.exit(0);
}

src = src.replace(before, after);
writeFileSync(classFile, src, "utf8");
console.log("[patch-prisma-wasm] Patched class.ts: small variant + production globalThis short-circuit");
