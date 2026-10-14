import { Suspense } from "react";

import { CachedStamp, RequestStamp } from "./stamps";

export default function Page() {
  return (
    <>
      <p className="demo-lead">
        Both boxes show when the server rendered them. Reload the page: the first time stays the same, the second
        one is new on every request.
      </p>

      <div className="cards">
        <section className="card" aria-labelledby="cached">
          <h2 id="cached">Cached with use cache</h2>
          <span className="tag">in the static shell</span>
          <CachedStamp />
          <p className="note">
            Rendered once, while the page was prerendered at build time. Every visitor gets this copy until the cache
            revalidates or the app is deployed again.
          </p>
        </section>

        <section className="card" aria-labelledby="per-request">
          <h2 id="per-request">Rendered per request</h2>
          <span className="tag">streamed in</span>
          <Suspense fallback={<p className="pending">Rendering at request time…</p>}>
            <RequestStamp />
          </Suspense>
          <p className="note">
            <code>connection()</code> waits for a real request. The static shell carries the fallback; this time
            streams in after it.
          </p>
        </section>
      </div>
    </>
  );
}
