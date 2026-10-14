import type { Metadata } from "next";

import { LabMark } from "@/lab/demo-shell";
import { demoPath, demos } from "@/lab/manifest";
import { LAB_URL, REPO_URL, SITE_URL, sourceUrl } from "@/lab/site";

export const metadata: Metadata = {
  title: "outofplace lab: live Next.js and React examples",
  description:
    "Working demos behind the tutorials on outofplace.space. Each one runs on the stated Next.js version, with its source, a README and the test that proves it.",
  alternates: { canonical: `${LAB_URL}/` },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-14" as "14 Oct 2026", without touching the clock. */
function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

export default function LabIndex() {
  const list = [...demos].sort((a, b) => b.created.localeCompare(a.created) || a.slug.localeCompare(b.slug));
  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="/">
          <LabMark />
          <span>outofplace lab</span>
        </a>
        <nav className="top-links" aria-label="Lab">
          <a href={`${SITE_URL}/blog`}>Blog</a>
          <a href={REPO_URL}>GitHub</a>
        </nav>
      </header>

      <section className="lead">
        <h1>Live examples for the posts on outofplace.space</h1>
        <p>
          Every tutorial on our blog stands on a demo that runs here. The code in the post is the code below, and
          each demo has a test that checks what the post claims.
        </p>
      </section>

      {list.length === 0 ? (
        <p className="empty">No demos yet.</p>
      ) : (
        <ul className="demo-list" aria-label="Demos">
          {list.map((demo) => (
            <li key={demo.slug} className="demo-item">
              <h2>
                <a href={demoPath(demo.slug)}>{demo.title}</a>
              </h2>
              {demo.summary ? <p>{demo.summary}</p> : null}
              <div className="meta">
                <span>Next.js {demo.next}</span>
                <span>
                  Updated <time dateTime={demo.updated}>{formatDay(demo.updated)}</time>
                </span>
                {demo.post ? <a href={demo.post}>Post</a> : null}
                <a href={sourceUrl(`app/demos/${demo.slug}`)}>Source</a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="foot">
        <p>
          Built by <a href={SITE_URL}>Outofplace</a>, a product studio. Code on <a href={REPO_URL}>GitHub</a>.
        </p>
      </footer>
    </div>
  );
}
