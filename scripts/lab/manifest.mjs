// demos.json: reading, writing and holding it to its rules. The rules live here once; the
// app (lab/manifest.ts) only reads the file, and `lab check` runs before every build.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, renameSync } from "node:fs";
import { join, posix } from "node:path";

import { EXIT, LabError } from "./util.mjs";

export const MANIFEST = "demos.json";
export const DEMOS_DIR = "app/demos";
export const LAB_URL = "https://lab.outofplace.space";
export const REPO_URL = "https://github.com/outof-place/outofplace-lab";
export const SITE_ORIGIN = "https://www.outofplace.space";
/** Left in every template file; a demo still carrying it is not written yet. */
export const TEMPLATE_MARKER = "lab:template";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const demoDir = (slug) => `${DEMOS_DIR}/${slug}`;
export const demoUrl = (slug) => `${LAB_URL}/demos/${slug}`;
export const specPath = (slug) => `${demoDir(slug)}/demo.spec.ts`;

export function isSlug(value) {
  return typeof value === "string" && value.length <= 60 && SLUG.test(value);
}

export function isPostUrl(value) {
  return typeof value === "string" && value.startsWith(`${SITE_ORIGIN}/`);
}

/** Today in Warsaw, as YYYY-MM-DD. LAB_TODAY overrides it for tests. */
export function today() {
  if (process.env.LAB_TODAY) return process.env.LAB_TODAY;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
}

/** The Next.js version installed in the lab. */
export function installedNext(root) {
  try {
    return JSON.parse(readFileSync(join(root, "node_modules/next/package.json"), "utf8")).version;
  } catch {
    throw new LabError(EXIT.ENV, "next-missing", "node_modules/next is missing; run pnpm install");
  }
}

export function loadManifest(root) {
  let text;
  try {
    text = readFileSync(join(root, MANIFEST), "utf8");
  } catch {
    throw new LabError(EXIT.ENV, "manifest-missing", `${MANIFEST} not found in ${root}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new LabError(EXIT.FAILED, "manifest-invalid", `${MANIFEST} is not valid JSON: ${error.message}`);
  }
}

/** Written whole, then renamed: a crash never leaves half a manifest. */
export function saveManifest(root, manifest) {
  const path = join(root, MANIFEST);
  writeFileSync(`${path}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
}

export function findDemo(manifest, slug) {
  const demo = manifest.demos?.find((d) => d.slug === slug);
  if (!demo) throw new LabError(EXIT.USAGE, "unknown-slug", `no demo "${slug}" in ${MANIFEST}`);
  return demo;
}

/** The entry plus what callers would otherwise derive by convention. */
export function describe(demo) {
  return { ...demo, url: demoUrl(demo.slug), dir: demoDir(demo.slug) };
}

/** A file's name inside its demo folder: "app/demos/x/page.tsx" -> "page.tsx". */
export function nameInDemo(slug, path) {
  return posix.relative(demoDir(slug), path);
}

/**
 * Every rule demos.json and app/demos/ must keep. Problems fail `lab check` (and so the
 * build); warnings are printed and pass.
 * @returns {{ problems: {slug: string|null, message: string}[], warnings: {slug: string|null, message: string}[] }}
 */
export function validate(root, manifest) {
  const problems = [];
  const warnings = [];
  const problem = (slug, message) => problems.push({ slug, message });

  if (manifest?.version !== 1 || !Array.isArray(manifest.demos)) {
    problem(null, `${MANIFEST} must be { "version": 1, "demos": [...] }`);
    return { problems, warnings };
  }

  let next = null;
  try {
    next = installedNext(root);
  } catch {
    warnings.push({ slug: null, message: "node_modules/next is missing, so versions were not compared" });
  }

  const seen = new Set();
  for (const demo of manifest.demos) {
    const slug = typeof demo?.slug === "string" ? demo.slug : null;
    if (!isSlug(slug)) {
      problem(slug, `slug must be lowercase words joined by single hyphens, at most 60 characters`);
      continue;
    }
    if (seen.has(slug)) problem(slug, "slug appears twice");
    seen.add(slug);

    const dir = demoDir(slug);
    const inDir = (path) => typeof path === "string" && path.startsWith(`${dir}/`) && !path.split("/").includes("..");

    if (typeof demo.title !== "string" || !demo.title.trim()) problem(slug, "title is empty");
    if (typeof demo.summary !== "string") problem(slug, "summary must be a string");
    if (typeof demo.next !== "string" || !VERSION.test(demo.next)) problem(slug, `next must be a version like 16.4.0`);
    else if (next && demo.next !== next) {
      warnings.push({ slug, message: `verified on Next.js ${demo.next}, the lab runs ${next}; run the test, then lab update` });
    }
    if (demo.post !== null && !isPostUrl(demo.post)) problem(slug, `post must be null or a URL under ${SITE_ORIGIN}/`);
    for (const key of ["created", "updated"]) {
      if (typeof demo[key] !== "string" || !DAY.test(demo[key])) problem(slug, `${key} must be YYYY-MM-DD`);
    }
    if (DAY.test(demo.created ?? "") && DAY.test(demo.updated ?? "") && demo.updated < demo.created) {
      problem(slug, "updated is earlier than created");
    }

    if (!existsSync(join(root, dir))) {
      problem(slug, `${dir}/ does not exist`);
      continue;
    }
    for (const required of ["page.tsx", "layout.tsx", "README.md", "demo.spec.ts"]) {
      if (!existsSync(join(root, dir, required))) problem(slug, `${dir}/${required} is missing`);
    }
    if (demo.test !== specPath(slug)) problem(slug, `test must be "${specPath(slug)}"`);

    if (!Array.isArray(demo.files) || demo.files.length === 0) {
      problem(slug, "files must list at least one file the post may show");
    } else {
      for (const file of demo.files) {
        if (!inDir(file)) problem(slug, `file "${file}" is not inside ${dir}/`);
        else if (!isFile(join(root, file))) problem(slug, `file "${file}" does not exist`);
        else if ([`${dir}/layout.tsx`, `${dir}/README.md`, specPath(slug)].includes(file)) {
          problem(slug, `file "${file}" is lab scaffolding, not demo code a post shows`);
        }
      }
      if (new Set(demo.files).size !== demo.files.length) problem(slug, "files lists a file twice");
    }

    for (const file of listFiles(join(root, dir))) {
      if (readFileSync(join(root, dir, file), "utf8").includes(TEMPLATE_MARKER)) {
        problem(slug, `${dir}/${file} is still the template (remove the "${TEMPLATE_MARKER}" line once it is written)`);
      }
    }

    const readme = join(root, dir, "README.md");
    if (existsSync(readme) && typeof demo.next === "string") {
      const line = readFileSync(readme, "utf8").match(/^Next\.js version: (.+)$/m);
      if (!line) problem(slug, `README.md needs a line "Next.js version: ${demo.next}"`);
      else if (line[1].trim() !== demo.next) problem(slug, `README.md says Next.js ${line[1].trim()}, demos.json says ${demo.next}`);
    }
  }

  // A folder under app/demos/ without an entry would be a live page nobody tracks.
  const demosRoot = join(root, DEMOS_DIR);
  if (existsSync(demosRoot)) {
    for (const entry of readdirSync(demosRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || /^[_(@]/.test(entry.name)) continue;
      if (!seen.has(entry.name)) problems.push({ slug: entry.name, message: `${DEMOS_DIR}/${entry.name}/ has no entry in ${MANIFEST}` });
    }
  }

  return { problems, warnings };
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Files under a folder, as paths relative to it. */
export function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}
