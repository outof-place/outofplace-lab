import { version } from "react";

import { BrowserReactVersion } from "./browser-version";
import { Notes } from "./notes";
import styles from "./react-19.module.css";

// A Server Component, so `version` is the React that renders on the server. The lab's
// package.json asks for react 19.3.1; the App Router uses the React build that ships inside Next.js.
export default function Page() {
  return (
    <>
      <dl className={styles.versions}>
        <div>
          <dt>Server</dt>
          <dd>
            <output aria-label="React on the server">{version}</output>
          </dd>
        </div>
        <div>
          <dt>Browser</dt>
          <dd>
            <output aria-label="React in the browser">
              <BrowserReactVersion />
            </output>
          </dd>
        </div>
      </dl>
      <Notes />
      <p className="hint">
        Add a note. It shows up at once as sending…, the button reads Adding… while the Server Function runs (it
        waits 1.5 s), and the note turns saved, with the server&apos;s time, when the answer arrives.
      </p>
    </>
  );
}
