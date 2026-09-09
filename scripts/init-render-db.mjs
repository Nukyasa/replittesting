import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Initialize the empty trial database during the build, which has more RAM.
// Runtime startup can then avoid loading PGlite's separate initdb WASM module.
const require = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const { PGlite } = require("@electric-sql/pglite");
const dataDir = process.env.PGLITE_DATA_DIR || fileURLToPath(new URL("../.pglite-db", import.meta.url));
if (!process.env.DATABASE_URL) {
  const client = new PGlite(dataDir, { initialMemory: 128 * 1024 * 1024 });
  try {
    await client.waitReady;
    await client.query("SELECT 1");
  } finally {
    await client.close();
  }
  console.log("Empty Render trial database initialized and closed.");
}
