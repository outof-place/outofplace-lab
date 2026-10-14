#!/usr/bin/env node
// The lab CLI: the contract the outofplace site build and the blog autopilot call.
//
//   node scripts/lab.mjs <command> [args]
//
// stdout carries exactly one JSON document, { "ok": true|false, "command": ..., ... }.
// Progress and child output (next build, Playwright) go to stderr.
// Exit codes: 0 ok, 1 checked thing not true, 2 bad call, 3 environment broke.
// README.md "Contract" is the reference; it is frozen, so add, never change.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { check, newDemo, snapshot, test, updateDemo, wait } from "./lab/commands.mjs";
import { EXIT, LabError } from "./lab/util.mjs";

const COMMANDS = {
  new: { run: newDemo, options: { title: { type: "string" }, summary: { type: "string" }, post: { type: "string" } } },
  update: { run: updateDemo, options: { title: { type: "string" }, summary: { type: "string" }, post: { type: "string" } } },
  check: { run: check, options: {} },
  test: { run: test, options: { url: { type: "string" }, "no-build": { type: "boolean" } } },
  snapshot: { run: snapshot, options: { out: { type: "string" } } },
  wait: {
    run: wait,
    options: { url: { type: "string" }, commit: { type: "string" }, timeout: { type: "string" }, interval: { type: "string" } },
  },
};

const USAGE = `usage: lab <command>
  new <slug> --title <title> [--summary <text>] [--post <url>]
  update <slug> [--title <title>] [--summary <text>] [--post <url>|none]
  check
  test [slug...] [--url <base>] [--no-build]
  snapshot <slug> --out <dir>
  wait --url <base> --commit <sha> [--timeout <s>] [--interval <s>]`;

// LAB_ROOT points the CLI at another checkout (its tests use throwaway repos).
const root = process.env.LAB_ROOT ? resolve(process.env.LAB_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), "..");

function print(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function main() {
  const [name, ...argv] = process.argv.slice(2);
  const command = COMMANDS[name];
  if (!command) {
    throw new LabError(EXIT.USAGE, name ? "unknown-command" : "no-command", name ? `unknown command "${name}"\n${USAGE}` : USAGE);
  }
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: command.options, allowPositionals: true, strict: true });
  } catch (error) {
    throw new LabError(EXIT.USAGE, "bad-args", `${error.message}\n${USAGE}`);
  }
  return command.run(root, parsed.positionals, parsed.values);
}

const name = process.argv[2] ?? null;
try {
  const result = await main();
  print({ ok: true, command: name, ...result });
  process.exitCode = EXIT.OK;
} catch (error) {
  if (error instanceof LabError) {
    print({ ok: false, command: name, ...error.extra, error: { code: error.code, message: error.message } });
    process.exitCode = error.exit;
  } else {
    print({ ok: false, command: name, error: { code: "internal", message: String(error?.stack ?? error) } });
    process.exitCode = EXIT.ENV;
  }
}
