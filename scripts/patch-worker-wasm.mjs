// Runs AFTER opennextjs-cloudflare build.
// Adds a static WebAssembly module import at the top of worker.js and assigns
// it to globalThis.__prisma_sqlite_wasm so that Prisma's decodeBase64AsWasm
// (patched by patch-prisma-wasm.mjs) can pick it up at runtime in CF Workers.
// Static imports are the ONLY way to get a WebAssembly.Module in CF Workers.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";

const WASM_SRC  = "prisma/sqlite_query_compiler.wasm";
const WASM_DEST = ".open-next/sqlite_query_compiler.wasm";
const WORKER    = ".open-next/worker.js";

if (!existsSync(WORKER)) {
  console.error("[patch-worker-wasm] worker.js not found — run opennextjs-cloudflare build first");
  process.exit(1);
}

copyFileSync(WASM_SRC, WASM_DEST);
console.log("[patch-worker-wasm] Copied", WASM_SRC, "→", WASM_DEST);

let worker = readFileSync(WORKER, "utf8");

if (worker.includes("__prisma_sqlite_wasm")) {
  console.log("[patch-worker-wasm] Already patched, skipping.");
  process.exit(0);
}

// Add static import + globalThis assignment at the very top.
// Wrangler processes the .wasm import via the CompiledWasm rule in wrangler.jsonc,
// giving us a pre-compiled WebAssembly.Module without any dynamic compilation.
const preamble = [
  `import __prisma_sqlite_wasm from './sqlite_query_compiler.wasm';`,
  `globalThis.__prisma_sqlite_wasm = __prisma_sqlite_wasm;`,
  "",
].join("\n");

writeFileSync(WORKER, preamble + worker, "utf8");
console.log("[patch-worker-wasm] Added static Wasm import + globalThis assignment to worker.js");
