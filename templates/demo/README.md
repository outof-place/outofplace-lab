<!-- lab:template (fill in every section; `lab check` fails while this line is here) -->

# __TITLE__

What it shows: one paragraph a reader can check against the live page.

Next.js version: __NEXT__

- Live: https://lab.outofplace.space/demos/__SLUG__
- Test: [`demo.spec.ts`](./demo.spec.ts)

## Files

- [`page.tsx`](./page.tsx): what this file does.

## Run it

From the repo root:

```sh
pnpm install
pnpm build && pnpm start              # production behaviour: http://localhost:3000/demos/__SLUG__
node scripts/lab.mjs test __SLUG__    # builds, then runs this demo's test
```

`next dev` works for editing, but caching and prerendering behave as described only in a production build.
