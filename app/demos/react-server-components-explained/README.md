# What reaches the browser

What it shows: a React Server Component and a Client Component on one Next.js page, and what each one sends to the browser. The Server Component (async, no directive) signs the request time with an HMAC key from a module marked `import "server-only"`; the browser gets the time and the signature as HTML and in the RSC payload, never the key or the component's code. The Client Component (`"use client"`) is a counter: it renders to HTML on the server, hydrates in the browser, and its code ships as JavaScript. A Server Component passed to it as `children` still renders on the server. Clicking Add one changes only the count, with no request; a reload makes the server sign a new time.

Next.js version: 16.4.0

- Live: https://lab.outofplace.space/demos/react-server-components-explained
- Test: [`demo.spec.ts`](./demo.spec.ts)

## Files

- [`page.tsx`](./page.tsx): the page, a Server Component. It puts `ServerCard` in `<Suspense>` and passes `ServerNote` into `Counter` as children.
- [`server-card.tsx`](./server-card.tsx): `ServerCard` (`await io()`, then the time and its signature) and `ServerNote`, both Server Components.
- [`signing.ts`](./signing.ts): `import "server-only"` and the HMAC made with `node:crypto`.
- [`counter.tsx`](./counter.tsx): `"use client"`, the counter, and a hydration check with `useSyncExternalStore`.
- `rsc.module.css`: the layout, sized for a 360x480 phone.

## What the test checks

1. The HTML response holds the Server Component's output in its markup, and again in an inline script (the RSC payload).
2. The signature is an HMAC-SHA256 of the time with the key in `signing.ts` (the test computes it itself).
3. The key is in no response the browser gets while it loads, hydrates and takes three clicks: HTML, payload, JavaScript, CSS.
4. A string from `counter.tsx` is in a JavaScript file; strings that exist only in `server-card.tsx` and `page.tsx` are in none.
5. With JavaScript off, the Client Component shows its server-rendered HTML ("server, not hydrated yet", count 0); with JavaScript on, it hydrates ("browser, after hydration").
6. The Server Component and the Server Component passed as children both report "server" on a hydrated page.
7. Three clicks on Add one set the count to 3 with no network request, and the time, the signature and the children stay the same.
8. Reload brings a later time, a new signature and the count back at 0.
9. At 360x480 both cards, all six rows and the button are on screen without scrolling.

## Why the time is per request

The lab runs with `cacheComponents: true`, which asks every route to decide what goes into the static shell built at `next build`. `await io()` before `new Date()` keeps the time out of the shell, so `ServerCard` renders on each request and streams in behind its `<Suspense>` fallback. The counter and `ServerNote` have no request data and are prerendered into the shell.

## Run it

From the repo root:

```sh
pnpm install
pnpm build && pnpm start                                   # http://localhost:3000/demos/react-server-components-explained
node scripts/lab.mjs test react-server-components-explained  # builds, then runs this demo's test
```

`next dev` works for editing; the static shell and the per-request time behave as described only in a production build.
