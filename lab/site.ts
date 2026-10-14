/** Where the lab lives, and who may frame it. One place for every URL the lab prints. */
export const LAB_URL = "https://lab.outofplace.space";
export const SITE_URL = "https://www.outofplace.space";
export const REPO_URL = "https://github.com/outof-place/outofplace-lab";

/** CSP frame-ancestors: the site in production, and any local dev server of the site. */
export const FRAME_ANCESTORS = [SITE_URL, "http://localhost:*", "http://127.0.0.1:*"];

/** The commit this deployment was built from ("" when the build could not tell). */
export const COMMIT = process.env.LAB_COMMIT ?? "";

/** A link to a path in the repo, pinned to the deployed commit when it is known. */
export function sourceUrl(path: string, kind: "tree" | "blob" = "tree"): string {
  return `${REPO_URL}/${kind}/${COMMIT || "main"}/${path}`;
}
