import { COMMIT } from "@/lab/site";

/**
 * Which commit production serves. `lab wait` polls it after a push, so the autopilot tests
 * the deploy it just made, not the one before. Prerendered at build time.
 */
export function GET() {
  return Response.json({ commit: COMMIT || null });
}
