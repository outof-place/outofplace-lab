import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const reply = "This reply is canned: a mock model streams it word by word, as a real provider would.";

// A stand-in for a provider's model: no key, no network, no cost. It answers every message with
// the same reply, one word per chunk, slow enough to watch. A new one per request, because a mock
// keeps every call it receives (doStreamCalls), which a test wants and a server does not.
export function cannedModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: 600, // the wait for the first token
        chunkDelayInMs: 150, // the gap between tokens
        chunks: [
          { type: "text-start", id: "text-1" },
          ...reply.split(/(?<= )/).map((delta) => ({ type: "text-delta" as const, id: "text-1", delta })),
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 17, text: 17, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}
