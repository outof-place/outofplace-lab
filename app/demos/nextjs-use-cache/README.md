# use cache: keys, lifetime and updateTag

What it shows: one cached function, `getStamp(city)`, marked `'use cache'` with `cacheLife('hours')` and a `cacheTag` per city, returns an id and a time made inside its body. Its entry is keyed by the argument: both rows that call `getStamp("gdansk")` show one id, `getStamp("krakow")` shows another, and reloading keeps both while the uncached row (behind `connection()`) changes on every load. "Clear" calls a Server Action that runs `updateTag` for that city's tag: that city gets a new id and the other keeps its own.

Next.js version: 16.4.3

- Live: https://lab.outofplace.space/demos/nextjs-use-cache
- Test: [`demo.spec.ts`](./demo.spec.ts)

## Files

- [`get-stamp.ts`](./get-stamp.ts): the cached function, with `cacheLife('hours')` and `cacheTag('city-<city>')`.
- [`actions.ts`](./actions.ts): the Server Action that calls `updateTag('city-<city>')`.
- [`page.tsx`](./page.tsx): the rows: two calls with `"gdansk"`, one with `"krakow"`, one uncached row inside `<Suspense>`, and a Clear button per city.
- `stamps.module.css`: layout only.

## Where the entries live

The rows are in the static shell, so the ids made at build time ship in the page's HTML. After "Clear", the page renders again: the cleared city's body runs, the other city's entry is reused. The test proves that on `next start`, a single long-lived server whose in-memory cache persists across requests. On serverless hosting, the default in-memory cache usually does not persist across requests ([docs](https://nextjs.org/docs/app/api-reference/directives/use-cache#runtime-caching-considerations)), so a city can get a new id on a later render there; a new deploy starts every entry again, since the build ID is part of the key.

## What the test checks

1. Reloading keeps the cached ids and times while the uncached row changes.
2. The two cities have separate entries with different ids.
3. The same argument returns the same entry: "Gdansk" and "Gdansk again" show one id and time.
4. Clearing Gdansk changes only the Gdansk id; Krakow stays the same.
5. With JavaScript off (only the HTML the server sent first), the cached ids are there and the uncached row shows its fallback.
6. On a 360x480 viewport all four rows and both Clear buttons are in view.

## Run it

From the repo root:

```sh
pnpm install
pnpm build && pnpm start                       # production behaviour: http://localhost:3000/demos/nextjs-use-cache
node scripts/lab.mjs test nextjs-use-cache     # builds, then runs this demo's test
```

`next dev` works for editing, but caching and prerendering behave as described only in a production build.
