import { io } from "next/cache";

import { sign } from "./signing";
import styles from "./rsc.module.css";

// Server Components: no directive, so they stay in the server module graph. The browser
// receives what they render (as HTML and in the RSC payload), never this code.

const renderedOn = () => (typeof window === "undefined" ? "server" : "browser");

export async function ServerCard() {
  // With Cache Components on, io() keeps what follows out of the build's static shell,
  // so the server signs a fresh time on every request.
  await io();
  const signedAt = new Date().toISOString();

  return (
    <section className={styles.card} aria-labelledby="server-component">
      <h2 id="server-component">Server Component</h2>
      <dl className={styles.rows}>
        <div>
          <dt>Rendered on</dt>
          <dd>{renderedOn()}</dd>
        </div>
        <div>
          <dt>Signed at</dt>
          <dd>
            <time dateTime={signedAt}>{signedAt.slice(11, 19)} UTC</time>
          </dd>
        </div>
        <div>
          <dt>Signature</dt>
          <dd>
            <code>{sign(signedAt)}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Passed to the Client Component as children: it renders here, on the server, and the
// Client Component only places its output.
export function ServerNote() {
  return <span>{renderedOn()}, passed in as children</span>;
}
