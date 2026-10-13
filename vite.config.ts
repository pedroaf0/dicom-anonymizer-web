// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this.
    server: { entry: "server" },
    // This app is browser-only; prerendering during the GitHub Pages static build
    // evaluates the route in Node and can fail on browser-only APIs used by the UI.
    // Keep it as a pure client static bundle instead of SSR prerendering.
    pages: [{ path: "/" }],
    prerender: { enabled: false, autoStaticPathsDiscovery: false },
  },
  vite: {
    // Relative asset paths so the app works under /dicom-anonymizer-web/ on GitHub Pages.
    base: "./",
  },
});
