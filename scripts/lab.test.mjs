// The CLI contract, tested against throwaway git repos (LAB_ROOT). Expected values come from
// git and the fixture itself, never from the code under test.

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = join(HERE, "lab.mjs");
const REPO = join(HERE, "..");
const TODAY = "2026-10-20";

/** Run the CLI; resolves with its exit code and parsed stdout. */
function lab(root, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [LAB, ...args], {
      env: { ...process.env, LAB_ROOT: root, LAB_TODAY: TODAY },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      let json;
      try {
        json = JSON.parse(out);
      } catch {
        reject(new Error(`stdout is not one JSON document:\n${out}\nstderr:\n${err}`));
        return;
      }
      resolve({ code, json });
    });
  });
}

const ALPHA = {
  slug: "alpha",
  title: "Alpha",
  summary: "",
  files: ["app/demos/alpha/page.tsx", "app/demos/alpha/widget.tsx"],
  test: "app/demos/alpha/demo.spec.ts",
  next: "16.4.0",
  post: null,
  created: "2026-10-14",
  updated: "2026-10-14",
};

/** A lab checkout with one written demo, "alpha", committed. */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "lab-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "lab@example.com");
  git("config", "user.name", "lab test");
  write("node_modules/next/package.json", JSON.stringify({ version: "16.4.0" }));
  write(".gitignore", "node_modules/\nout/\n");
  cpSync(join(REPO, "templates"), join(root, "templates"), { recursive: true });
  write("app/demos/alpha/page.tsx", 'import { Widget } from "./widget";\nexport default function Page() {\n  return <Widget />;\n}\n');
  write("app/demos/alpha/widget.tsx", "export function Widget() {\n  return <p>first</p>;\n}\n");
  write("app/demos/alpha/layout.tsx", "// lab chrome\n");
  write("app/demos/alpha/README.md", "# Alpha\n\nNext.js version: 16.4.0\n");
  write("app/demos/alpha/demo.spec.ts", "// spec\n");
  write("demos.json", `${JSON.stringify({ version: 1, demos: [ALPHA] }, null, 2)}\n`);
  git("add", "-A");
  git("commit", "-qm", "fixture");
  const manifest = () => JSON.parse(readFileSync(join(root, "demos.json"), "utf8"));
  return { root, git, write, manifest };
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

test("snapshot exports exactly the manifest's files as committed at HEAD, with HEAD's SHA", async (t) => {
  const { root, git, write } = fixture(t);
  // A second commit, so a snapshot of the first commit's content would be caught.
  write("app/demos/alpha/widget.tsx", "export function Widget() {\n  return <p>second</p>;\n}\n");
  git("commit", "-qam", "change widget");
  const head = git("rev-parse", "HEAD");
  const out = join(root, "out/lab/alpha");

  const { code, json } = await lab(root, ["snapshot", "alpha", "--out", out]);

  assert.equal(code, 0, JSON.stringify(json));
  assert.equal(json.commit, head);
  const doc = JSON.parse(readFileSync(join(out, "snapshot.json"), "utf8"));
  assert.equal(doc.commit, head);
  assert.equal(doc.slug, "alpha");
  assert.deepEqual(
    doc.files.map((f) => f.path),
    ALPHA.files,
  );
  for (const file of doc.files) {
    const committed = git("show", `${head}:${file.path}`) + "\n";
    assert.equal(file.content, committed, file.path);
    assert.equal(file.sha256, sha256(committed), file.path);
    assert.equal(file.bytes, Buffer.byteLength(committed), file.path);
    assert.equal(file.url, `https://github.com/outof-place/outofplace-lab/blob/${head}/${file.path}`);
  }
  assert.deepEqual(
    doc.files.map((f) => f.name),
    ["page.tsx", "widget.tsx"],
  );
  assert.equal(doc.sourceUrl, `https://github.com/outof-place/outofplace-lab/tree/${head}/app/demos/alpha`);
  assert.match(doc.files[1].content, /second/);
  // stdout lists the same files without their content
  assert.deepEqual(
    json.files.map((f) => [f.path, f.sha256]),
    doc.files.map((f) => [f.path, f.sha256]),
  );
  assert.equal(json.files[0].content, undefined);
});

test("snapshot of the same commit twice writes the same bytes", async (t) => {
  const { root } = fixture(t);
  const out = join(root, "out/alpha");
  assert.equal((await lab(root, ["snapshot", "alpha", "--out", out])).code, 0);
  const first = readFileSync(join(out, "snapshot.json"));
  assert.equal((await lab(root, ["snapshot", "alpha", "--out", out])).code, 0);
  assert.ok(first.equals(readFileSync(join(out, "snapshot.json"))));
});

test("snapshot refuses when a shown file differs from HEAD", async (t) => {
  const { root, write } = fixture(t);
  write("app/demos/alpha/widget.tsx", "export function Widget() {\n  return <p>uncommitted</p>;\n}\n");
  const out = join(root, "out/alpha");

  const { code, json } = await lab(root, ["snapshot", "alpha", "--out", out]);

  assert.equal(code, 1);
  assert.equal(json.error.code, "dirty");
  assert.ok(json.dirty.some((line) => line.endsWith("app/demos/alpha/widget.tsx")));
  assert.equal(existsSync(join(out, "snapshot.json")), false);
});

test("snapshot refuses a listed file that was never committed", async (t) => {
  const { root, git, write } = fixture(t);
  write("app/demos/alpha/extra.tsx", "export const extra = 1;\n");
  const m = JSON.parse(readFileSync(join(root, "demos.json"), "utf8"));
  m.demos[0].files.push("app/demos/alpha/extra.tsx");
  write("demos.json", `${JSON.stringify(m, null, 2)}\n`);
  git("add", "demos.json");
  git("commit", "-qm", "list extra but forget to add it");

  const { code, json } = await lab(root, ["snapshot", "alpha", "--out", join(root, "out/alpha")]);

  assert.equal(code, 1);
  assert.equal(json.error.code, "dirty");
});

test("snapshot will not overwrite a snapshot.json it did not write", async (t) => {
  const { root, write } = fixture(t);
  write("out/alpha/snapshot.json", '{"hello":"world"}\n');

  const { code, json } = await lab(root, ["snapshot", "alpha", "--out", join(root, "out/alpha")]);

  assert.equal(code, 2);
  assert.equal(json.error.code, "out-taken");
  assert.equal(readFileSync(join(root, "out/alpha/snapshot.json"), "utf8"), '{"hello":"world"}\n');
});

test("new scaffolds a demo that check rejects until the template is replaced", async (t) => {
  const { root, manifest } = fixture(t);
  const title = 'Beta "quoted" title';

  const created = await lab(root, ["new", "beta", "--title", title, "--post", "https://www.outofplace.space/blog/beta"]);

  assert.equal(created.code, 0, JSON.stringify(created.json));
  const entry = manifest().demos.find((d) => d.slug === "beta");
  assert.deepEqual(entry, {
    slug: "beta",
    title,
    summary: "",
    files: ["app/demos/beta/page.tsx"],
    test: "app/demos/beta/demo.spec.ts",
    next: "16.4.0",
    post: "https://www.outofplace.space/blog/beta",
    created: TODAY,
    updated: TODAY,
  });
  for (const name of ["page.tsx", "layout.tsx", "README.md", "demo.spec.ts"]) {
    assert.ok(existsSync(join(root, "app/demos/beta", name)), name);
  }
  assert.ok(readFileSync(join(root, "app/demos/beta/demo.spec.ts"), "utf8").includes(JSON.stringify(title)));
  assert.ok(readFileSync(join(root, "app/demos/beta/layout.tsx"), "utf8").includes('const slug = "beta";'));
  assert.ok(readFileSync(join(root, "app/demos/beta/README.md"), "utf8").includes("Next.js version: 16.4.0"));

  const checked = await lab(root, ["check"]);
  assert.equal(checked.code, 1);
  const betaProblems = checked.json.problems.filter((p) => p.slug === "beta").map((p) => p.message);
  assert.equal(betaProblems.length, 3, betaProblems.join("\n"));
  assert.ok(betaProblems.every((m) => m.includes("lab:template")));
  assert.equal(checked.json.problems.filter((p) => p.slug === "alpha").length, 0);
});

test("new refuses an existing slug and a malformed one, and leaves the manifest alone", async (t) => {
  const { root, manifest } = fixture(t);
  const before = manifest();

  const taken = await lab(root, ["new", "alpha", "--title", "Again"]);
  const bad = await lab(root, ["new", "Not_A_Slug", "--title", "Bad"]);
  const untitled = await lab(root, ["new", "gamma"]);

  assert.deepEqual([taken.code, taken.json.error.code], [2, "exists"]);
  assert.deepEqual([bad.code, bad.json.error.code], [2, "bad-slug"]);
  assert.deepEqual([untitled.code, untitled.json.error.code], [2, "bad-args"]);
  assert.deepEqual(manifest(), before);
  assert.equal(existsSync(join(root, "app/demos/gamma")), false);
});

test("check reports a missing listed file and a demo folder with no entry", async (t) => {
  const { root, write } = fixture(t);
  rmSync(join(root, "app/demos/alpha/widget.tsx"));
  write("app/demos/orphan/page.tsx", "export default function Page() { return null; }\n");

  const { code, json } = await lab(root, ["check"]);

  assert.equal(code, 1);
  const messages = json.problems.map((p) => `${p.slug}: ${p.message}`);
  assert.ok(messages.some((m) => m.startsWith("alpha:") && m.includes("widget.tsx") && m.includes("does not exist")), messages.join("\n"));
  assert.ok(messages.some((m) => m.startsWith("orphan:") && m.includes("no entry")), messages.join("\n"));
});

test("check passes a clean lab and lists each demo with its URL", async (t) => {
  const { root } = fixture(t);
  const { code, json } = await lab(root, ["check"]);
  assert.equal(code, 0, JSON.stringify(json.problems));
  assert.deepEqual(json.demos[0].url, "https://lab.outofplace.space/demos/alpha");
});

test("update sets the post, refreshes the date, and rejects a post off the site", async (t) => {
  const { root, manifest } = fixture(t);

  const ok = await lab(root, ["update", "alpha", "--post", "https://www.outofplace.space/blog/alpha"]);
  const off = await lab(root, ["update", "alpha", "--post", "https://evil.example/alpha"]);
  const unknown = await lab(root, ["update", "nope"]);

  assert.equal(ok.code, 0);
  const entry = manifest().demos[0];
  assert.equal(entry.post, "https://www.outofplace.space/blog/alpha");
  assert.equal(entry.updated, TODAY);
  assert.equal(entry.created, "2026-10-14");
  assert.deepEqual([off.code, off.json.error.code], [2, "bad-post"]);
  assert.deepEqual([unknown.code, unknown.json.error.code], [2, "unknown-slug"]);
});

test("wait returns once the URL serves the commit, and times out when it never does", async (t) => {
  const { root } = fixture(t);
  const served = "0123456789abcdef0123456789abcdef01234567";
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/version.json")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ commit: served }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;

  const hit = await lab(root, ["wait", "--url", url, "--commit", served.slice(0, 7)]);
  const miss = await lab(root, ["wait", "--url", url, "--commit", "fedcba9", "--timeout", "1", "--interval", "0.2"]);

  assert.equal(hit.code, 0, JSON.stringify(hit.json));
  assert.equal(hit.json.served, served);
  assert.deepEqual([miss.code, miss.json.error.code, miss.json.served], [1, "timeout", served]);
});

test("a wrong call exits 2 and still prints one JSON document", async (t) => {
  const { root } = fixture(t);
  const unknown = await lab(root, ["publish"]);
  const flag = await lab(root, ["check", "--force"]);
  assert.deepEqual([unknown.code, unknown.json.ok, unknown.json.error.code], [2, false, "unknown-command"]);
  assert.deepEqual([flag.code, flag.json.error.code], [2, "bad-args"]);
});
