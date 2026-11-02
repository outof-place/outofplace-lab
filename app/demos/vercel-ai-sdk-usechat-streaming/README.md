# useChat, no API key

What it shows: a chat built on `useChat` from `@ai-sdk/react` that talks to a Next.js route handler over HTTP, the way a real AI SDK app does, except that the route's model is a mock. The route runs `streamText` on `MockLanguageModelV4` (from `ai/test`), whose `doStream` returns `simulateReadableStream` chunks of a canned reply, and returns the result as a UI message stream. Send a message: it appears at once, the status goes `submitted`, `streaming`, `ready`, and the reply grows word by word from the message's `text` part. No provider, no key, no paid call, nothing stored: a reload clears the chat.

Next.js version: 16.4.3

AI SDK: `ai` 7.0.152, `@ai-sdk/react` 4.0.156 (see `package.json`).

- Live: https://lab.outofplace.space/demos/vercel-ai-sdk-usechat-streaming
- Test: [`demo.spec.ts`](./demo.spec.ts)

## Files

- [`chat.tsx`](./chat.tsx): the client component. `useChat` with a `DefaultChatTransport` pointed at the demo's route, the `status` it returns, messages rendered from `parts`, and a form that calls `sendMessage`.
- [`api/chat/route.ts`](./api/chat/route.ts): the route handler. `POST` reads the UI messages, converts them with `convertToModelMessages`, calls `streamText`, and returns `createUIMessageStreamResponse({ stream: toUIMessageStream(...) })`.
- [`canned-model.ts`](./canned-model.ts): the mock model. One `text-start`, seventeen `text-delta` chunks (one per word), `text-end` and `finish`, 600 ms before the first and 150 ms between the rest.
- [`page.tsx`](./page.tsx): the page, a Server Component that renders the chat.

`chat.module.css` holds the demo's styles.

## What the test checks

1. Sending a message shows it in the list at once; the status shows `submitted` or `streaming`, and the full sequence is `ready`, `submitted`, `streaming`, `ready`.
2. The reply text takes at least five different values, each one growing from the last, and ends as the full reply.
3. The input is disabled while the reply streams, usable again at `ready`, and a second message works.
4. The assistant message renders one `text` part; its parts are `step-start, text`.
5. Every request the page makes goes to its own origin, and the only `POST` is to the demo's route.
6. The route answers with `text/event-stream` and `x-vercel-ai-ui-message-stream: v1`: `start`, `start-step`, `text-start`, seventeen `text-delta` events, `text-end`, `finish-step`, `finish`, then `[DONE]`.
7. A reload clears the chat.
8. At 360x480 the status, both messages, the input and the Send button are all in view without scrolling.

## Run it

From the repo root:

```sh
pnpm install
pnpm build && pnpm start                                    # http://localhost:3000/demos/vercel-ai-sdk-usechat-streaming
node scripts/lab.mjs test vercel-ai-sdk-usechat-streaming   # builds, then runs this demo's test
```

To use a real model, replace `cannedModel()` in `api/chat/route.ts` with a provider's model and set its key in the environment. Nothing in `chat.tsx` changes.
