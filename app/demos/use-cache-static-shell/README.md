# use cache and the static shell

What it shows: with Cache Components on, one page mixes two kinds of rendering. A component marked `'use cache'` runs once while the page is prerendered at build time, and its output ships in the static shell, so its timestamp is the same on every load. A component that awaits `connection()` inside `<Suspense>` is left out of the shell: the shell carries its fallback, and the component renders on every request and streams in, so its timestamp is new each time.

Next.js version: 16.4.3

- Live: https://lab.outofplace.space/demos/use-cache-static-shell
- Test: [`demo.spec.ts`](./demo.spec.ts)

## Files

- [`page.tsx`](./page.tsx): the page. The cached box sits in the shell directly; the per-request box sits inside `<Suspense>` with a fallback.
- [`stamps.tsx`](./stamps.tsx): `CachedStamp` (`'use cache'` with `cacheLife('max')`) and `RequestStamp` (`await connection()`), each rendering the time it ran.

The app enables the feature in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};
```

## What the test checks

1. The cached time is the same on two loads a second apart.
2. The per-request time is later on the second load.
3. The cached time is earlier than the request time on the same page: it was rendered before the request arrived.
4. With JavaScript off (only the static shell is shown), the cached time is visible, the per-request box shows its fallback, and no request time is shown.

## Why the cached time can still change

`cacheLife('max')` revalidates after 30 days, and every deploy builds a new shell, so the time moves on each deploy of the lab. On serverless hosting, a `'use cache'` entry filled at request time (not at build time) lives in one instance's memory, so this demo only relies on the build-time copy in the shell.

## Run it

From the repo root:

```sh
pnpm install
pnpm build && pnpm start                          # http://localhost:3000/demos/use-cache-static-shell
node scripts/lab.mjs test use-cache-static-shell  # builds, then runs this demo's test
```

`next dev` does not serve a prerendered shell, so see the behaviour described here in a production build.
