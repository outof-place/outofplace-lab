// Page speed from the browser's own Performance APIs, without a library.

// web.dev's thresholds: good up to the first value, poor above the second, needs improvement
// in between. Times are in milliseconds, CLS is a score.
export const thresholds = {
  ttfb: [800, 1800],
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
} as const;

export type Rating = "good" | "needs improvement" | "poor";

export function rate(metric: keyof typeof thresholds, value: number): Rating {
  const [good, poor] = thresholds[metric];
  if (value <= good) return "good";
  return value <= poor ? "needs improvement" : "poor";
}

// TTFB and load time come from the page's navigation entry, in ms since the navigation
// started. loadEventEnd stays 0 until the load event's handlers have finished, so read it in
// a task queued after the load event.
export function onNavigation(report: (ttfb: number, load: number) => void) {
  const read = () => {
    const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (nav) report(nav.responseStart, nav.loadEventEnd);
  };
  if (document.readyState === "complete") setTimeout(read);
  else addEventListener("load", () => setTimeout(read), { once: true });
}

// LCP: the browser reports a new entry each time a larger element paints, and stops at the
// first scroll, click or key press. The last entry is the page's LCP.
export function observeLcp(report: (ms: number) => void) {
  return observe("largest-contentful-paint", (entries) => {
    const last = entries.at(-1);
    if (last) report(last.startTime);
  });
}

type LayoutShift = PerformanceEntry & { value: number; hadRecentInput: boolean };

// CLS: shifts less than 1 s apart form a session window of at most 5 s, and CLS is the
// largest window's sum. A shift within 500 ms of a click or key press is expected: skip it.
export function observeCls(report: (score: number) => void) {
  let cls = 0;
  let current = 0;
  let first = 0;
  let last = 0;
  const stop = observe("layout-shift", (entries) => {
    for (const shift of entries as LayoutShift[]) {
      if (shift.hadRecentInput) continue;
      if (current > 0 && shift.startTime - last < 1000 && shift.startTime - first < 5000) {
        current += shift.value;
      } else {
        current = shift.value;
        first = shift.startTime;
      }
      last = shift.startTime;
      cls = Math.max(cls, current);
    }
    report(cls);
  });
  if (stop) report(cls); // no shift yet is a CLS of 0
  return stop;
}

// Returns null where the browser doesn't support the entry type (layout-shift outside
// Chromium), otherwise a function that stops observing.
function observe(type: string, onEntries: (entries: PerformanceEntryList) => void) {
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) return null;
  const observer = new PerformanceObserver((list) => onEntries(list.getEntries()));
  // `buffered` also delivers the entries recorded before this call. It works only with
  // `type` (one entry type per call), never with `entryTypes`.
  observer.observe({ type, buffered: true });
  return () => observer.disconnect();
}
