import assert from "node:assert/strict";
import { test } from "node:test";

import openPr, { commandPattern, opener, prUrls } from "../src/extension.ts";

type Handler = (event: unknown, ctx: unknown) => unknown;

function harness(env: Record<string, string> = {}, platform = "darwin") {
  const handlers: Record<string, Handler> = {};
  const runs: string[][] = [];
  const notes: string[] = [];
  const pi = {
    on: (name: string, handler: Handler) => {
      handlers[name] = handler;
    },
    exec: async (command: string, args: string[]) => {
      runs.push([command, ...args]);
      return { code: 0, stdout: "", stderr: "", killed: false };
    },
  };
  openPr(pi as never, platform, env);
  const ctx = { mode: "tui", hasUI: true, ui: { notify: (m: string) => notes.push(m) } };
  const bash = (command: string, text: string, extra: object = {}, c: object = ctx) =>
    handlers.tool_result!(
      { toolName: "bash", input: { command }, content: [{ type: "text", text }], ...extra },
      c,
    );
  return { handlers, runs, notes, bash, ctx };
}

const URL = "https://github.com/acme/widgets/pull/42";

test("opens the PR that gh pr create printed", async () => {
  const h = harness();
  await h.bash("gh pr create --fill", `Creating pull request\n${URL}\n`);
  assert.deepEqual(h.runs, [["open", URL]]);
  assert.deepEqual(h.notes, [`Opened ${URL}`]);
});

test("opens each URL once per session", async () => {
  const h = harness();
  await h.bash("gh pr create --fill", URL);
  await h.bash("gh pr create --fill", URL);
  assert.equal(h.runs.length, 1);
  await h.handlers.session_start!({}, h.ctx);
  await h.bash("gh pr create --fill", URL);
  assert.equal(h.runs.length, 2);
});

test("ignores commands that only mention a PR", async () => {
  const h = harness();
  await h.bash("gh pr view 42", URL);
  await h.bash("echo gh pr creates", URL);
  assert.deepEqual(h.runs, []);
});

test("ignores failed commands, other tools, and non-TUI runs", async () => {
  const h = harness();
  await h.bash("gh pr create", URL, { isError: true });
  await h.bash("gh pr create", URL, { toolName: "read" });
  await h.bash("gh pr create", URL, {}, { mode: "print", hasUI: false });
  await h.bash("gh pr create", URL, {}, { mode: "rpc", hasUI: true });
  assert.deepEqual(h.runs, []);
});

test("PI_OPEN_PR_COMMANDS adds commands", async () => {
  const h = harness({ PI_OPEN_PR_COMMANDS: String.raw`\bsilk\s+pr\b` });
  await h.bash("silk pr --title 'feat: x' --body-file b.md src", `done: ${URL}`);
  assert.deepEqual(h.runs, [["open", URL]]);
  assert.ok(commandPattern({}).test("glab mr create"));
});

test("finds GitHub and GitLab URLs, without trailing punctuation", () => {
  assert.deepEqual(prUrls(`see ${URL}. And ${URL}`), [URL]);
  assert.deepEqual(prUrls("https://gitlab.com/a/b/-/merge_requests/7)"), [
    "https://gitlab.com/a/b/-/merge_requests/7",
  ]);
  assert.deepEqual(prUrls(`${URL}/files`), []);
});

test("stays quiet over SSH, when disabled, or with no display", () => {
  assert.equal(opener("darwin", { SSH_CONNECTION: "1 2 3 4" }), null);
  assert.equal(opener("darwin", { PI_OPEN_PR: "0" }), null);
  assert.equal(opener("linux", {}), null);
  assert.equal(opener("linux", { DISPLAY: ":0" })?.command, "xdg-open");
  assert.deepEqual(opener("win32", {})?.args(URL), ["/c", "start", "", URL]);
});
