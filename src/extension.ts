// Opens a pull request in the browser as soon as an agent creates one.
//
// Watches bash results (including bash calls made from codemode). When the
// command created a PR and its output holds the PR's URL, the URL opens with
// the platform's opener. Agents do not need to remember anything.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Commands that create a PR or merge request. Extend with PI_OPEN_PR_COMMANDS. */
const DEFAULT_COMMANDS = String.raw`\bgh\s+pr\s+create\b|\bglab\s+mr\s+create\b|\bhub\s+pull-request\b`;

/** GitHub pull requests and GitLab merge requests. */
const PR_URL =
  /https?:\/\/[^\s"'<>()]+?\/(?:pull\/\d+|-\/merge_requests\/\d+)(?![\w/])/g;

export type Env = Record<string, string | undefined>;

export function commandPattern(env: Env): RegExp {
  const extra = env.PI_OPEN_PR_COMMANDS?.trim();
  return new RegExp(extra ? `${DEFAULT_COMMANDS}|${extra}` : DEFAULT_COMMANDS);
}

export function prUrls(text: string): string[] {
  return [...new Set(text.match(PR_URL) ?? [])];
}

/** The opener for this machine, or null where a browser would open somewhere unseen. */
export function opener(
  platform: string,
  env: Env,
): { command: string; args: (url: string) => string[] } | null {
  if (env.PI_OPEN_PR === "0" || env.PI_OPEN_PR === "false") return null;
  // Over SSH the browser would open on the remote machine.
  if (env.SSH_CONNECTION || env.SSH_TTY) return null;
  if (platform === "darwin") return { command: "open", args: (url) => [url] };
  if (platform === "win32")
    return { command: "cmd", args: (url) => ["/c", "start", "", url] };
  if (env.DISPLAY || env.WAYLAND_DISPLAY)
    return { command: "xdg-open", args: (url) => [url] };
  return null;
}

type BashResult = {
  toolName: string;
  input?: unknown;
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

type Ctx = {
  mode?: string;
  hasUI?: boolean;
  ui?: { notify?: (message: string, level: "info" | "warning" | "error") => void };
};

export default function openPr(
  pi: ExtensionAPI,
  platform: string = process.platform,
  env: Env = process.env,
) {
  const opened = new Set<string>();
  const commands = commandPattern(env);

  pi.on("session_start", () => {
    opened.clear();
  });

  pi.on("tool_result", async (event: BashResult, ctx: Ctx) => {
    if (event.toolName.toLowerCase() !== "bash" || event.isError) return;
    // Only someone at the terminal sees the browser. Print, JSON and RPC
    // runs (subagents, CI, card runners) stay quiet.
    if (ctx.mode !== "tui") return;
    const command = String((event.input as { command?: unknown })?.command ?? "");
    if (!commands.test(command)) return;
    const launch = opener(platform, env);
    if (!launch) return;

    const output = (event.content ?? [])
      .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
      .join("\n");
    for (const url of prUrls(output).slice(0, 3)) {
      if (opened.has(url)) continue;
      opened.add(url);
      const result = await pi.exec(launch.command, launch.args(url), { timeout: 10_000 });
      if (result.code === 0) ctx.ui?.notify?.(`Opened ${url}`, "info");
      else ctx.ui?.notify?.(`Could not open ${url}: ${result.stderr.trim()}`, "warning");
    }
  });
}
