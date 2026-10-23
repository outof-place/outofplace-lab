import "server-only";

import { createHmac } from "node:crypto";

// A made-up key, public in this repo. In an app it comes from process.env. Either way it lives
// only in the server module graph: import "server-only" turns an import from a "use client"
// file into a build error.
const SIGNING_KEY = "lab-demo-key-stays-on-the-server";

/** The first 12 hex characters of an HMAC-SHA256 of `value`, made with Node's crypto module. */
export function sign(value: string): string {
  return createHmac("sha256", SIGNING_KEY).update(value).digest("hex").slice(0, 12);
}
