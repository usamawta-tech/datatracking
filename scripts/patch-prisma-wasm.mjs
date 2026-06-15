// Patches Prisma's generated class.ts so that in production (Cloudflare Workers)
// the Wasm query compiler is loaded via WebAssembly.compileStreaming(fetch(url))
// instead of new WebAssembly.Module(buffer), which is blocked by Cloudflare.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "fs";
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

if (!existsSync(wasmDest)) {
  const src = readFileSync(wasmBase64File, "utf8");
  const match = src.match(/const wasm = "([^"]+)"/);
  if (!match) throw new Error("[patch-prisma-wasm] Could not find base64 wasm string");
  const buf = Buffer.from(match[1], "base64");
  mkdirSync(path.dirname(wasmDest), { recursive: true });
  writeFileSync(wasmDest, buf);
  console.log(`[patch-prisma-wasm] Extracted ${buf.length} bytes → ${wasmDest}`);
}

// ── 2. Patch generated class.ts ───────────────────────────────────────────
const classFile = path.join(root, "app/generated/prisma/internal/class.ts");
let src = readFileSync(classFile, "utf8");

const before = `async function decodeBase64AsWasm(wasmBase64: string): Promise<WebAssembly.Module> {
  const { Buffer } = await import('node:buffer')
  const wasmArray = Buffer.from(wasmBase64, 'base64')
  return new WebAssembly.Module(wasmArray)
}`;

const after = `async function decodeBase64AsWasm(wasmBase64: string): Promise<WebAssembly.Module> {
  // In Cloudflare Workers, new WebAssembly.Module(buffer) is blocked.
  // Use compileStreaming(fetch(url)) with the .wasm served as a static asset.
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === 'production' && appUrl) {
    const wasmUrl = \`\${appUrl}/_prisma/sqlite_query_compiler.wasm\`;
    const response = await fetch(wasmUrl);
    return WebAssembly.compileStreaming(response);
  }
  const { Buffer } = await import('node:buffer');
  const wasmArray = Buffer.from(wasmBase64, 'base64');
  return new WebAssembly.Module(wasmArray);
}`;

if (src.includes("sqlite_query_compiler.wasm")) {
  console.log("[patch-prisma-wasm] Already patched, skipping.");
  process.exit(0);
}

if (!src.includes("decodeBase64AsWasm")) {
  console.warn("[patch-prisma-wasm] WARNING: expected function not found — Prisma may have changed.");
  process.exit(0);
}

writeFileSync(classFile, src.replace(before, after), "utf8");
console.log("[patch-prisma-wasm] Patched decodeBase64AsWasm in", classFile);
