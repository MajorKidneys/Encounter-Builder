// Bundles the server into one file, pulling in the app's own code (monster library, gear rules)
// so imported rows are built exactly like ones added by hand.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(here, "src/index.ts")],
  outfile: path.join(here, "dist/index.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  alias: { "@": path.join(here, "..", "src") },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
