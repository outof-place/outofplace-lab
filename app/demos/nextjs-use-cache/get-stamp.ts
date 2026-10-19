import { cacheLife, cacheTag } from "next/cache";

export type City = "gdansk" | "krakow";

// One cached function. The entry's key is built from its argument, so getStamp("gdansk") and
// getStamp("krakow") are two entries, and every call with "gdansk" shares one.
export async function getStamp(city: City) {
  "use cache";
  cacheLife("hours"); // revalidate after 1 hour, expire after 1 day
  cacheTag(`city-${city}`); // updateTag("city-gdansk") clears this city's entry only

  // Produced inside the cached body: a new id means the body ran again.
  return { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString() };
}
