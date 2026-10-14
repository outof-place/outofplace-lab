import type { Metadata } from "next";
import type { ReactNode } from "react";

// Every demo page is noindex, follow, even one whose own layout forgets demoMetadata().
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function DemosLayout({ children }: { children: ReactNode }) {
  return children;
}
