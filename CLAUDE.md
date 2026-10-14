# outofplace lab: notes for agents

README.md is the reference: the demo layout, `demos.json`, and the `scripts/lab.mjs` contract (frozen 2026-10-14; add, never change meaning).

- One demo per post, in `app/demos/<slug>/`. Start one with `node scripts/lab.mjs new`, never by hand.
- Public repo and public site: no secrets, no paid API calls, no user data, no live AI calls (show recorded runs).
- Demo files hold only demo code. Lab chrome stays in the demo's `layout.tsx`; shared CSS classes come from `app/globals.css`.
- Verify every Next.js API against `node_modules/next/dist/docs` before using it. Caching behaves as the docs say only in a production build, so judge it with `node scripts/lab.mjs test`, not `next dev`.
- `demo.spec.ts` has one test per claim the post makes. Break the demo once and see the test fail before trusting it.
- No animation libraries. Keep pages small and fast.
- Before a push: `node scripts/lab.mjs check` and `node scripts/lab.mjs test` pass. A push to `main` deploys production.
- Git: English, `type(scope): message`, scopes `lab` (app, CLI, tests) and `demos` (a demo).
