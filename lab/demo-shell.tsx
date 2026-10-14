import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDemo } from "./manifest";
import { LAB_URL, SITE_URL, sourceUrl } from "./site";

/**
 * The lab's frame around one demo: what it is, where its post and source are, and the
 * Next.js version it was verified on. Each demo's layout.tsx renders it, so the demo's own
 * files (the ones a post shows) carry no lab code.
 *
 * Links target the top window: inside the post's iframe they leave the frame.
 */
export function DemoShell({ slug, children }: { slug: string; children: ReactNode }) {
  const demo = getDemo(slug);
  return (
    <div className="shell">
      <header className="shell-bar" data-lab-shell={slug}>
        <a className="shell-home" href={LAB_URL} target="_top">
          <LabMark />
          <span>outofplace lab</span>
        </a>
        <nav className="shell-links" aria-label="Demo">
          <a href={demo.post ?? `${SITE_URL}/blog`} target="_top">
            {demo.post ? "Read the post" : "Blog"}
          </a>
          <a href={sourceUrl(`app/demos/${slug}`)} target="_top">
            Source
          </a>
          <span className="shell-version">Next.js {demo.next}</span>
        </nav>
      </header>
      <main className="demo">
        <h1 className="demo-title">{demo.title}</h1>
        {children}
      </main>
    </div>
  );
}

/** Demo pages never compete with their post: noindex, but links are followed. */
export function demoMetadata(slug: string): Metadata {
  const demo = getDemo(slug);
  return {
    title: `${demo.title} · outofplace lab`,
    description: demo.summary,
    robots: { index: false, follow: true },
  };
}

export function LabMark() {
  return (
    <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <path
        transform="translate(11 15)"
        d="M21.7803 34.7825C35.7801 34.4531 43.1918 1.69356 41.5447 0.804161C40.1118 0.0629959 32.6672 21.2439 21.0721 21.2768C9.47694 21.3097 1.7194 0.161819 0.533539 0.804161C-0.932322 1.59474 7.63226 35.1284 21.7803 34.7825Z"
        fill="var(--canvas)"
      />
    </svg>
  );
}
