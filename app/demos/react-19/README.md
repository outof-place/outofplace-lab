# React 19 Actions in Next.js

What it shows: one form built on React 19 Actions in the App Router. The form's action goes through `useActionState` to a Server Function that waits 1.5 s and returns the saved notes. `useOptimistic` puts the new note in the list at once, marked sending; `useFormStatus` turns the button into a disabled "Adding…" while the action runs; when the Server Function returns, the note is marked saved with the server's time and React clears the input. An empty note comes back as an error in the same state. Above the form, the page prints `version` from `react` twice: from a Server Component and from a Client Component after hydration. Both read `19.3.0-canary-278794d7-20261002`, the React build inside Next.js, although `package.json` asks for `react@19.3.1`.

Next.js version: 16.4.3

- Live: https://lab.outofplace.space/demos/react-19
- Test: [`demo.spec.ts`](./demo.spec.ts)

## Files

- [`actions.ts`](./actions.ts): the Server Function `addNote(previous, formData)`, in a `"use server"` file.
- [`notes.tsx`](./notes.tsx): the Client Component with the form: `useActionState`, `useOptimistic`, and a submit button on `useFormStatus`.
- [`page.tsx`](./page.tsx): the page, a Server Component that prints the server's React version and renders the form.
- [`browser-version.tsx`](./browser-version.tsx): prints the browser's React version once hydrated, through `useSyncExternalStore`.
- `react-19.module.css`: layout only.

## What the test checks

1. The server-rendered version and the hydrated browser version both read `19.3.0-canary-278794d7-20261002`; a script the page loads carries that string, and none carries `19.3.1`, the version in `package.json`.
2. A submitted note appears within a second, marked sending, before any saved note exists.
3. While the action runs, the button reads "Adding…" and is disabled; afterwards it reads "Add" again.
4. When the Server Function returns, the note is marked saved, its time is at least 1.4 s after the click, and no sending note is left.
5. The input keeps the typed text while the action runs and is empty once it finishes.
6. A blank note shows the server's error "Write a note first." and adds nothing; the next valid note clears the error.
7. On a 360x480 viewport, both versions, the input, the button and the saved note are in view without scrolling.

## Run it

From the repo root:

```sh
pnpm install
pnpm build && pnpm start              # production behaviour: http://localhost:3000/demos/react-19
node scripts/lab.mjs test react-19    # builds, then runs this demo's test
```

Nothing is stored: a reload starts with an empty list.
