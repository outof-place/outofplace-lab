# Measure page speed

What it shows: a page that measures its own speed with the browser's Performance APIs and no library. TTFB and load time come from the navigation entry (`responseStart`, and `loadEventEnd` read after the load event); LCP and CLS come from `PerformanceObserver` with `type` and `buffered: true`. Each number gets web.dev's good, needs improvement or poor label (load time has no threshold). Two controls change the result: **Insert banner** puts a 160 px banner above the numbers 1 s after the click, with no space kept for it, and CLS rises above 0.1; **Late hero** reloads the page with `?late`, a big text block paints 3 s after the navigation started, and LCP moves past 3 s. **Reset** loads the page again.

Next.js version: 16.4.3

- Live: https://lab.outofplace.space/demos/measure-page-speed-in-browser
- Test: [`demo.spec.ts`](./demo.spec.ts)

## Files

- [`vitals.ts`](./vitals.ts): the measurement, framework-free: `onNavigation` (TTFB, load time), `observeLcp`, `observeCls` (session windows, skipping shifts with `hadRecentInput`), web.dev's thresholds and `rate`.
- [`speed-report.tsx`](./speed-report.tsx): the client component. Starts the measurement in an effect, renders the four cards, the banner, the late hero and the controls.
- [`page.tsx`](./page.tsx): the page, a Server Component: the report and a short note on lab against field data and INP.
- [`speed.module.css`](./speed.module.css): the layout, one column that fits a 360x480 phone frame.

## What the test checks

1. Chromium supports `largest-contentful-paint`, `layout-shift` and `navigation` in `PerformanceObserver.supportedEntryTypes`.
2. After load, all four cards show a number; TTFB is above 0 and load time is later than TTFB.
3. The labels match web.dev's thresholds (LCP 2.5 s and 4 s, CLS 0.1 and 0.25, TTFB 0.8 s and 1.8 s); load time shows "no threshold".
4. A fresh load has a good LCP and a CLS of 0.000.
5. In the post's phone (360x480) and desktop (672x420) frames, Insert banner raises CLS above 0.1 and the label to "needs improvement", and the LCP and CLS cards stay in view.
6. In the same frames, Late hero moves LCP to between 3 s and 4 s ("needs improvement") and leaves CLS at 0; in a full desktop window LCP moves past 3 s too.
7. Reset loads the page without `?late`: no banner, CLS 0, no late hero, LCP good.
8. The page tells lab data from field data and says INP needs a real interaction.
9. On a 360x480 phone, the four cards and the three controls are fully in view without scrolling.

## Why the controls work the way they do

- The banner waits 1 s: a layout shift within 500 ms of a click or key press gets `hadRecentInput` and does not count towards CLS.
- Late hero reloads the page: the browser stops reporting LCP entries at the first scroll, click or key press, so a click cannot move LCP on the same page. The hero is `position: fixed`, so it moves LCP without shifting anything.

## Run it

From the repo root:

```sh
pnpm install
pnpm build && pnpm start              # production behaviour: http://localhost:3000/demos/measure-page-speed-in-browser
node scripts/lab.mjs test measure-page-speed-in-browser    # builds, then runs this demo's test
```

Measure in a production build: `next dev` compiles on request and adds its own overlay, so its numbers are not the page's.
