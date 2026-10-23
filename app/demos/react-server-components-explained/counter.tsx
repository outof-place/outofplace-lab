"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import styles from "./rsc.module.css";

const subscribe = () => () => {};

// A Client Component: "use client" puts this file and everything it imports in the browser's
// JavaScript. It still renders to HTML on the server first, then hydrates in the browser.
export function Counter({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  // The server snapshot (false) is used on the server and during hydration; once hydrated,
  // React renders again with the browser's snapshot (true).
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <section className={styles.card} aria-labelledby="client-component">
      <h2 id="client-component">Client Component</h2>
      <dl className={styles.rows}>
        <div>
          <dt>Rendered on</dt>
          <dd>{hydrated ? "browser, after hydration" : "server, not hydrated yet"}</dd>
        </div>
        <div>
          <dt>Count</dt>
          <dd>
            <output aria-label="Count">{count}</output>
            <button type="button" onClick={() => setCount((n) => n + 1)}>
              Add one
            </button>
          </dd>
        </div>
        <div>
          <dt>Children</dt>
          <dd>{children}</dd>
        </div>
      </dl>
    </section>
  );
}
