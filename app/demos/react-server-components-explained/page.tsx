import { Suspense } from "react";

import { Counter } from "./counter";
import { ServerCard, ServerNote } from "./server-card";
import styles from "./rsc.module.css";

// The page is a Server Component too: pages and layouts are, unless a file says "use client".
export default function Page() {
  return (
    <div className={styles.stack}>
      <Suspense fallback={<p className={styles.pending}>Signing on the server…</p>}>
        <ServerCard />
      </Suspense>

      <Counter>
        <ServerNote />
      </Counter>

      <p className={styles.hint}>
        Add one changes the count in the browser and leaves the signature as it is. <a href="">Reload</a> and the
        server signs a new time.
      </p>
    </div>
  );
}
