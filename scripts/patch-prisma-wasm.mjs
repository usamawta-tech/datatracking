// Patches Prisma's generated class.ts so that in production (Cloudflare Workers)
// the Wasm query compiler is loaded from globalThis.__prisma_sqlite_wasm,
// which is set by a static import in worker.js (the only way to get
// WebAssembly.Module in CF Workers without dynamic compilation).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ── 1. Extract .wasm binary from base64 if public asset is missing ─────────
const wasmBase64File = path.join(
  root,
  "node_modules/@prisma/client/runtime/query_compiler_fast_bg.sqlite.wasm-base64.mjs"
);
const wasmDest = path.join(root, "public/_prisma/sqlite_query_compiler.wasm");
const wasmPrisma = path.join(root, "prisma/sqlite_query_compiler.wasm");

for (const dest of [wasmDest, wasmPrisma]) {
  if (!existsSync(dest)) {
    const src = readFileSync(wasmBase64File, "utf8");
    const match = src.match(/const wasm = "([^"]+)"/);
    if (!match) throw new Error("[patch-prisma-wasm] Could not find base64 wasm string");
    const buf = Buffer.from(match[1], "base64");
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    console.log(`[patch-prisma-wasm] Extracted ${buf.length} bytes → ${dest}`);
  }
}

// ── 2. Patch generated class.ts ───────────────────────────────────────────
const classFile = path.join(root, "app/generated/prisma/internal/class.ts");
let src = readFileSync(classFile, "utf8");

if (src.includes("__prisma_sqlite_wasm")) {
  console.log("[patch-prisma-wasm] Already patched, skipping.");
  process.exit(0);
}

if (!src.includes("decodeBase64AsWasm")) {
  console.warn("[patch-prisma-wasm] WARNING: expected function not found.");
  process.exit(0);
}

const before = `async function decodeBase64AsWasm(wasmBase64: string): Promise<WebAssembly.Module> {
  const { Buffer } = await import('node:buffer')
  const wasmArray = Buffer.from(wasmBase64, 'base64')
  return new WebAssembly.Module(wasmArray)
}`;

// In CF Workers, globalThis.__prisma_sqlite_wasm is set by a static import
// in worker.js (processed by wrangler as CompiledWasm). For local dev,
// fall back to the standard new WebAssembly.Module(buffer) path.
const after = `async function decodeBase64AsWasm(wasmBase64: string): Promise<WebAssembly.Module> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const precompiled = (globalThis as any).__prisma_sqlite_wasm;
  if (precompiled) return precompiled;
  const { Buffer } = await import('node:buffer');
  const wasmArray = Buffer.from(wasmBase64, 'base64');
  return new WebAssembly.Module(wasmArray);
}`;

writeFileSync(classFile, src.replace(before, after), "utf8");
console.log("[patch-prisma-wasm] Patched decodeBase64AsWasm to use globalThis.__prisma_sqlite_wasm");
