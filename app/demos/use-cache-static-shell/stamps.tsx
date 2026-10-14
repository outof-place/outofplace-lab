import { cacheLife } from "next/cache";
import { connection } from "next/server";

// Cached: `use cache` lets Next.js run this once while prerendering at build time and keep
// the output in the page's static shell. cacheLife("max") revalidates it after 30 days at
// most; a new deploy starts a new cache.
export async function CachedStamp() {
  "use cache";
  cacheLife("max");
  return <Stamp at={new Date()} />;
}

// Per request: connection() makes rendering wait for a real request, so this never runs at
// build time. It renders on every request and streams in behind its Suspense fallback.
export async function RequestStamp() {
  await connection();
  return <Stamp at={new Date()} />;
}

function Stamp({ at }: { at: Date }) {
  const iso = at.toISOString();
  return (
    <p className="stamp">
      <time dateTime={iso}>
        {iso.slice(0, 10)} {iso.slice(11, 19)} UTC
      </time>
    </p>
  );
}
