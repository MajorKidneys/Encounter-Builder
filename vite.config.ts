// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Relative asset paths so the production build also works when loaded via
  // file:// inside the Electron desktop wrapper.
  vite: { base: "./" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Prerender both routes to static HTML so the Electron desktop build can
    // load them from file:// with no server. All state is localStorage, so the
    // HTML is identical for every visitor.
    pages: [{ path: "/" }, { path: "/spells" }],
    prerender: { enabled: true, autoStaticPathsDiscovery: false },
  },
});
