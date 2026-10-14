import manifest from "@/demos.json";

/** One entry of demos.json. scripts/lab.mjs owns the file; `lab check` holds it to this shape. */
export type Demo = {
  slug: string;
  title: string;
  summary: string;
  /** Repo-relative paths a post may show, all inside app/demos/<slug>/. */
  files: string[];
  /** Repo-relative path of the Playwright spec that proves the demo's claims. */
  test: string;
  /** The Next.js version the demo was last verified on. */
  next: string;
  /** The post on www.outofplace.space this demo belongs to, once it exists. */
  post: string | null;
  created: string;
  updated: string;
};

export const demos: Demo[] = manifest.demos;

export function getDemo(slug: string): Demo {
  const demo = demos.find((d) => d.slug === slug);
  if (!demo) throw new Error(`demos.json has no demo "${slug}"; run \`pnpm lab check\``);
  return demo;
}

export function demoPath(slug: string): string {
  return `/demos/${slug}`;
}
