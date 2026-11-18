# pi-open-pr

A [pi](https://pi.dev) extension that opens a pull request in your browser as soon as an agent creates one.

```
   ┌─ pi ──────────────────────────┐        ┌─ browser ───────────────────────────┐
   │ $ gh pr create --fill         │        │ ● ● ●   github.com/you/repo/pull/42 │
   │ Creating pull request…        │        ├─────────────────────────────────────┤
   │ https://github.com/you/repo/  │  ───▶  │  feat: the thing you asked for      │
   │   pull/42                     │  open  │  ✓ Open   wants to merge 1 commit   │
   │                               │        │                                     │
   │ ✓ Opened …/pull/42            │        │       \(^o^)/  review me!           │
   └───────────────────────────────┘        └─────────────────────────────────────┘
```

Agents finish a branch, run `gh pr create`, and print a URL into a scrollback you may not be watching. This extension clicks that link for you. Nothing goes in a prompt or an `AGENTS.md`, so an agent can't forget to do it.

## How it works

The extension watches every `bash` tool result, including bash calls made from codemode. It opens a URL when all of these hold:

- The command created a PR: `gh pr create`, `glab mr create` or `hub pull-request`.
- The command succeeded and its output contains a GitHub `/pull/<n>` or GitLab `/-/merge_requests/<n>` URL.
- The session is the interactive terminal UI. Print, JSON and RPC runs (subagents, CI, card runners) never open anything.
- Someone can see the browser. The extension stays quiet over SSH, and on Linux it needs `DISPLAY` or `WAYLAND_DISPLAY`.

Each URL opens once per session. It uses `open` on macOS, `xdg-open` on Linux and `start` on Windows, and shows a short notice in pi.

## Install

```
pi install git:github.com/aglowinthefield/pi-open-pr
```

Then run `/reload` in any open pi session. You can also symlink `src/extension.ts` into `~/.pi/agent/extensions/`.

## Configure

Both settings are environment variables in the shell that starts pi.

| Variable | Effect |
| --- | --- |
| `PI_OPEN_PR_COMMANDS` | A regex of extra commands that create PRs, for wrappers around `gh`. Example: `\bsilk\s+pr\b` |
| `PI_OPEN_PR=0` | Turns the extension off |

## Develop

```
npm test
```

The tests run on Node 23 or later with no dependencies.

## License

MIT
