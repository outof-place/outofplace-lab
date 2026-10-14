import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

import { FRAME_ANCESTORS } from "./lab/site";

/** The commit this build serves: Vercel names it; a local build asks git. */
function buildCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // Every demo runs on the defaults a reader gets from create-next-app, plus Cache Components
  // (the 16.x rendering model the tutorials teach). A demo that needs another global flag does
  // not belong in this app.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  env: { LAB_COMMIT: buildCommit() },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Only the outofplace site (and a local dev server) may frame the lab.
          { key: "Content-Security-Policy", value: `frame-ancestors ${FRAME_ANCESTORS.join(" ")}` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The post ranks, not the demo. The page also says so in <meta name="robots">.
        source: "/demos/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
    ];
  },
};

export default nextConfig;
