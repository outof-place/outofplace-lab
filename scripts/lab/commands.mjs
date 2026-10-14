// The six lab commands. Each takes (root, positionals, flags) and returns the JSON result;
// failures throw LabError with their exit code. README.md "Contract" documents them.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  REPO_URL,
  TEMPLATE_MARKER,
  demoDir,
  demoUrl,
  describe,
  findDemo,
  installedNext,
  isPostUrl,
  isSlug,
  loadManifest,
  nameInDemo,
  saveManifest,
  specPath,
  today,
  validate,
} from "./manifest.mjs";
import { EXIT, LabError, baseUrl, freePort, git, log, runToStderr, sleep, usage } from "./util.mjs";

const TEMPLATE_DIR = "templates/demo";
export const SNAPSHOT_FILE = "snapshot.json";
export const SNAPSHOT_SCHEMA = 1;

function postFlag(value) {
  if (value === undefined) return undefined;
  if (value === "none") return null;
  if (!isPostUrl(value)) throw usage("bad-post", `--post must be a URL under https://www.outofplace.space/ or "none"`);
  return value;
}

function oneSlug(positionals, command) {
  const [slug, ...rest] = positionals;
  if (!slug || rest.length) throw usage("bad-args", `usage: lab ${command} <slug>`);
  return slug;
}

/** lab new <slug> --title <title> [--summary <text>] [--post <url>] */
export async function newDemo(root, positionals, flags) {
  const slug = oneSlug(positionals, "new --title <title>");
  if (!isSlug(slug)) throw usage("bad-slug", `"${slug}" is not a slug: lowercase words joined by single hyphens, at most 60 characters`);
  const title = flags.title?.trim();
  if (!title) throw usage("bad-args", "--title is required");
  const post = postFlag(flags.post) ?? null;

  const manifest = loadManifest(root);
  if (manifest.demos.some((d) => d.slug === slug) || existsSync(join(root, demoDir(slug)))) {
    throw usage("exists", `demo "${slug}" already exists`);
  }

  const next = installedNext(root);
  const day = today();
  const dir = demoDir(slug);
  mkdirSync(join(root, dir), { recursive: true });
  const created = [];
  try {
    for (const name of readdirSync(join(root, TEMPLATE_DIR)).sort()) {
      let text = readFileSync(join(root, TEMPLATE_DIR, name), "utf8");
      // In code the title sits in a string literal, so it goes in JSON-quoted.
      text = /\.tsx?$/.test(name) ? text.replaceAll('"__TITLE__"', JSON.stringify(title)) : text.replaceAll("__TITLE__", title);
      text = text.replaceAll("__SLUG__", slug).replaceAll("__NEXT__", next);
      writeFileSync(join(root, dir, name), text);
      created.push(`${dir}/${name}`);
    }
    const demo = {
      slug,
      title,
      summary: flags.summary?.trim() ?? "",
      files: [`${dir}/page.tsx`],
      test: specPath(slug),
      next,
      post,
      created: day,
      updated: day,
    };
    manifest.demos.push(demo);
    saveManifest(root, manifest);
    return {
      demo: describe(demo),
      created,
      todo: `replace the files carrying "${TEMPLATE_MARKER}", list shown files in demos.json, then lab check and lab test ${slug}`,
    };
  } catch (error) {
    rmSync(join(root, dir), { recursive: true, force: true });
    throw error;
  }
}

/** lab update <slug> [--title <t>] [--summary <s>] [--post <url>|none] */
export async function updateDemo(root, positionals, flags) {
  const slug = oneSlug(positionals, "update");
  const manifest = loadManifest(root);
  const demo = findDemo(manifest, slug);
  if (flags.title !== undefined) {
    if (!flags.title.trim()) throw usage("bad-args", "--title cannot be empty");
    demo.title = flags.title.trim();
  }
  if (flags.summary !== undefined) demo.summary = flags.summary.trim();
  const post = postFlag(flags.post);
  if (post !== undefined) demo.post = post;
  demo.next = installedNext(root);
  demo.updated = today();
  saveManifest(root, manifest);

  const readme = join(root, demoDir(slug), "README.md");
  if (existsSync(readme)) {
    const text = readFileSync(readme, "utf8");
    writeFileSync(readme, text.replace(/^Next\.js version: .+$/m, `Next.js version: ${demo.next}`));
  }
  return { demo: describe(demo) };
}

/** lab check: the manifest against the files. Exit 1 on any problem. */
export async function check(root) {
  const manifest = loadManifest(root);
  const { problems, warnings } = validate(root, manifest);
  const result = { demos: (manifest.demos ?? []).map(describe), problems, warnings };
  if (problems.length) {
    throw new LabError(EXIT.FAILED, "manifest-problems", `${problems.length} problem(s) in demos.json or app/demos/`, result);
  }
  return result;
}

/**
 * lab snapshot <slug> --out <dir>
 * Writes <dir>/snapshot.json: the demo's shown files exactly as committed at HEAD, and HEAD.
 */
export async function snapshot(root, positionals, flags) {
  const slug = oneSlug(positionals, "snapshot --out <dir>");
  if (!flags.out) throw usage("bad-args", "--out <dir> is required");
  const manifest = loadManifest(root);
  const demo = findDemo(manifest, slug);
  const { problems } = validate(root, { version: manifest.version, demos: [demo] });
  const own = problems.filter((p) => p.slug === slug);
  if (own.length) throw new LabError(EXIT.FAILED, "manifest-problems", `demo "${slug}" fails lab check`, { problems: own });

  // The SHA must describe the files: nothing shown (and not the manifest) may differ from HEAD.
  const dirty = (await git(root, ["status", "--porcelain", "--untracked-files=all", "--", "demos.json", ...demo.files]))
    .split("\n")
    .filter(Boolean);
  if (dirty.length) {
    throw new LabError(EXIT.FAILED, "dirty", "commit the demo first: shown files differ from HEAD", { dirty });
  }
  const commit = (await git(root, ["rev-parse", "HEAD"])).trim();
  const pushed = (await git(root, ["merge-base", "--is-ancestor", "HEAD", "origin/main"], { allowFail: true })) !== null;

  const files = [];
  for (const path of demo.files) {
    const content = await git(root, ["show", `${commit}:${path}`], { raw: true });
    files.push({
      name: nameInDemo(slug, path),
      path,
      lang: path.split(".").at(-1),
      bytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
      url: `${REPO_URL}/blob/${commit}/${path}`,
      content: content.toString("utf8"),
    });
  }

  const outDir = resolve(flags.out);
  const outFile = join(outDir, SNAPSHOT_FILE);
  if (existsSync(outFile)) {
    let previous = null;
    try {
      previous = JSON.parse(readFileSync(outFile, "utf8"));
    } catch {}
    if (previous?.schema !== SNAPSHOT_SCHEMA || previous?.slug !== slug) {
      throw usage("out-taken", `${outFile} exists and is not a snapshot of "${slug}"; refusing to overwrite it`);
    }
  }

  // No timestamp: exporting the same commit twice writes the same bytes.
  const doc = {
    schema: SNAPSHOT_SCHEMA,
    slug,
    title: demo.title,
    commit,
    next: demo.next,
    updated: demo.updated,
    demoUrl: demoUrl(slug),
    sourceUrl: `${REPO_URL}/tree/${commit}/${demoDir(slug)}`,
    files,
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outFile}.tmp`, `${JSON.stringify(doc, null, 2)}\n`);
  renameSync(`${outFile}.tmp`, outFile);

  return { slug, commit, pushed, out: outFile, files: files.map(({ content, ...meta }) => meta) };
}

/**
 * lab test [slug...] [--url <base>] [--no-build]
 * No slug: every demo and the lab-wide tests. No --url: build, serve with next start, test.
 */
export async function test(root, positionals, flags) {
  const manifest = loadManifest(root);
  const slugs = positionals;
  for (const slug of slugs) findDemo(manifest, slug);
  const specs = slugs.map(specPath);
  const remote = flags.url ? baseUrl(flags.url) : null;

  const reportPath = join(root, "test-results", "lab-report.json");
  rmSync(reportPath, { force: true });
  // The child sees our environment plus the target; a LAB_BASE_URL we inherited must not
  // redirect a local run.
  const env = { ...process.env, LAB_REPORT: reportPath };
  delete env.LAB_BASE_URL;
  if (remote) {
    env.LAB_BASE_URL = remote;
  } else {
    if (!flags["no-build"]) {
      log("next build");
      const code = await runToStderr(join(root, "node_modules/.bin/next"), ["build"], { cwd: root });
      if (code !== 0) throw new LabError(EXIT.ENV, "build-failed", `next build exited with ${code}`);
    } else if (!existsSync(join(root, ".next/BUILD_ID"))) {
      throw new LabError(EXIT.ENV, "no-build", "--no-build needs an existing build in .next/");
    }
    env.LAB_PORT = String(await freePort());
  }
  const target = remote ?? `http://localhost:${env.LAB_PORT}`;
  log(`playwright against ${target}${specs.length ? ` (${slugs.join(", ")})` : " (all)"}`);

  const started = Date.now();
  const code = await runToStderr(join(root, "node_modules/.bin/playwright"), ["test", ...specs], { cwd: root, env });

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    throw new LabError(EXIT.ENV, "no-report", `playwright exited with ${code} and wrote no report (server or browser did not start?)`);
  }
  const stats = {
    passed: report.stats?.expected ?? 0,
    failed: report.stats?.unexpected ?? 0,
    flaky: report.stats?.flaky ?? 0,
    skipped: report.stats?.skipped ?? 0,
  };
  const failures = collectFailures(report);
  const errors = (report.errors ?? []).map((e) => clean(e.message ?? String(e)));
  const result = {
    target,
    demos: slugs.length ? slugs : manifest.demos.map((d) => d.slug),
    specs: specs.length ? specs : "all",
    stats,
    failures,
    errors,
    durationMs: Date.now() - started,
    report: reportPath,
  };
  if (stats.failed || errors.length) {
    const message = stats.failed ? `${stats.failed} test(s) failed` : `Playwright reported ${errors.length} error(s) outside tests`;
    throw new LabError(EXIT.FAILED, "tests-failed", message, result);
  }
  if (stats.passed + stats.flaky === 0) throw new LabError(EXIT.FAILED, "no-tests", "no test ran", result);
  return result;
}

const ANSI = /\u001b\[[0-9;]*m/g;
const clean = (text) => String(text).replace(ANSI, "").slice(0, 2000);

/** Failed tests from Playwright's JSON report. Top-level suites are files; deeper ones are describe blocks. */
function collectFailures(report) {
  const out = [];
  const walk = (suite, trail) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (t.status !== "unexpected") continue;
        const last = t.results?.at(-1);
        out.push({
          file: spec.file,
          title: [...trail, spec.title].join(" > "),
          error: clean(last?.error?.message ?? last?.errors?.[0]?.message ?? "failed"),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...trail, child.title]);
  };
  for (const file of report.suites ?? []) walk(file, []);
  return out;
}

/** lab wait --url <base> --commit <sha> [--timeout <s>] [--interval <s>] */
export async function wait(root, positionals, flags) {
  if (positionals.length) throw usage("bad-args", "usage: lab wait --url <base> --commit <sha>");
  if (!flags.url) throw usage("bad-args", "--url is required");
  const url = baseUrl(flags.url);
  const commit = flags.commit?.trim().toLowerCase();
  if (!commit || !/^[0-9a-f]{7,40}$/.test(commit)) throw usage("bad-args", "--commit must be 7 to 40 hex characters");
  const timeoutMs = seconds(flags.timeout, 900, "--timeout") * 1000;
  const intervalMs = seconds(flags.interval, 10, "--interval") * 1000;

  const started = Date.now();
  let served = null;
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      const res = await fetch(`${url}/version.json?t=${Date.now()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) served = (await res.json())?.commit ?? null;
    } catch {}
    if (served && served.toLowerCase().startsWith(commit)) {
      return { url, commit, served, attempts, waitedMs: Date.now() - started };
    }
    if (Date.now() - started + intervalMs > timeoutMs) {
      throw new LabError(EXIT.FAILED, "timeout", `${url} still serves ${served ?? "nothing"} after ${Math.round((Date.now() - started) / 1000)} s`, {
        url,
        commit,
        served,
        attempts,
        waitedMs: Date.now() - started,
      });
    }
    log(`waiting for ${commit.slice(0, 7)} on ${url} (serving ${served?.slice(0, 7) ?? "nothing"})`);
    await sleep(intervalMs);
  }
}

function seconds(value, fallback, flag) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw usage("bad-args", `${flag} must be a positive number of seconds`);
  return n;
}
