import type { MetadataRoute } from "next";

import { LAB_URL } from "@/lab/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${LAB_URL}/sitemap.xml`,
  };
}
