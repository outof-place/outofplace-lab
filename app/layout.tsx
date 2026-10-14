import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { LAB_URL } from "@/lab/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(LAB_URL),
  applicationName: "outofplace lab",
  authors: [{ name: "Outofplace", url: "https://www.outofplace.space" }],
  publisher: "Outofplace Poland sp. z o.o.",
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
