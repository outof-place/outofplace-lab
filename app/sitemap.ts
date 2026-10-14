import type { MetadataRoute } from "next";

import { demos } from "@/lab/manifest";
import { LAB_URL } from "@/lab/site";

// Only the index: demo pages are noindex, so listing them here would contradict it.
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = demos.map((d) => d.updated).sort().at(-1);
  return [{ url: `${LAB_URL}/`, lastModified: updated }];
}
