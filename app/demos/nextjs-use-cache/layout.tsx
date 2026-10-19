// Lab chrome for this demo: title bar, post and source links, noindex. Not part of the demo,
// so it is never in demos.json "files" and a post never shows it.
import type { ReactNode } from "react";

import { DemoShell, demoMetadata } from "@/lab/demo-shell";

const slug = "nextjs-use-cache";

export const metadata = demoMetadata(slug);

export default function Layout({ children }: { children: ReactNode }) {
  return <DemoShell slug={slug}>{children}</DemoShell>;
}
