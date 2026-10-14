// Shared plumbing for the lab CLI: the error type that carries an exit code, child processes
// whose output never reaches stdout (stdout is the JSON result), and git.

import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";

/** Exit codes, frozen with the contract in README.md. */
export const EXIT = {
  OK: 0,
  /** The thing checked is not true: a test failed, the manifest has problems, a deploy never came. */
  FAILED: 1,
  /** The call was wrong: unknown command or slug, bad flag, refused output path. */
  USAGE: 2,
  /** The environment broke: build failed, server or browser did not start, git missing. */
  ENV: 3,
};

export class LabError extends Error {
  /**
   * @param {number} exit one of EXIT
   * @param {string} code stable machine-readable reason
   * @param {string} message for a person
   * @param {Record<string, unknown>} [extra] merged into the JSON result
   */
  constructor(exit, code, message, extra = {}) {
    super(message);
    this.exit = exit;
    this.code = code;
    this.extra = extra;
  }
}

export const usage = (code, message) => new LabError(EXIT.USAGE, code, message);

/** Progress for a person, on stderr. */
export function log(message) {
  process.stderr.write(`lab: ${message}\n`);
}

/**
 * Run a command with its output on our stderr. Resolves with the exit code.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} opts env replaces ours when given
 */
export function runToStderr(cmd, args, { cwd, env = process.env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", 2, 2] });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  });
}

/**
 * git in the lab root. Returns stdout (Buffer when `raw`), throws LabError(ENV) on failure.
 * @param {string} root
 * @param {string[]} args
 * @param {{ raw?: boolean, allowFail?: boolean }} [opts]
 */
export function git(root, args, { raw = false, allowFail = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd: root, encoding: raw ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && !allowFail) {
          reject(
            new LabError(EXIT.ENV, "git-failed", `git ${args.join(" ")} failed: ${String(stderr).trim() || error.message}`),
          );
          return;
        }
        resolve(error ? null : stdout);
      },
    );
  });
}

/** A TCP port nothing listens on right now. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

/** "https://lab.outofplace.space/" -> "https://lab.outofplace.space"; rejects anything not http(s). */
export function baseUrl(value, flag = "--url") {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw usage("bad-url", `${flag} must be an absolute http(s) URL, got "${value}"`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw usage("bad-url", `${flag} must be http(s), got "${value}"`);
  }
  return url.href.replace(/\/+$/, "");
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
