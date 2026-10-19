import { SpeedReport } from "./speed-report";
import styles from "./speed.module.css";

// The page is static: the numbers are measured in the browser by the client component.
export default function Page() {
  return (
    <>
      <SpeedReport />

      <section className={styles.notes} aria-labelledby="lab-or-field">
        <h2 id="lab-or-field">Lab or field</h2>
        <p>
          These are lab numbers: one load, in this browser, on this network, like Lighthouse or the DevTools
          Performance panel. Core Web Vitals are judged on field data: real Chrome visits in the Chrome UX Report
          (CrUX), shown in PageSpeed Insights, at the 75th percentile.
        </p>
        <p>
          INP, the third Core Web Vital, needs a real interaction, so a page that has just loaded has none to report.
          Load time is not a Core Web Vital and has no Google threshold.
        </p>
      </section>
    </>
  );
}
