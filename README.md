# usage-status

A Claude Code mod that puts your usage in the status line: the model and its effort, the context fill, the session's tokens and cost, and how much of your 5-hour and weekly limits you have used.

```
[Opus 5.5 · medium] ctx 45.2k/200.0k (23%) | in 1.2M out 34.5k | $1.23 | 5h 12% (3h 10m) | week 34% (2d 4h)
```

<!-- screenshot: add docs/screenshot.png here -->

## What each part means

| Part | Meaning |
| --- | --- |
| `[Opus 5.5 · medium]` | The model, and the effort of its last request. Before the first request, the effort comes from your settings. |
| `ctx 45.2k/200.0k (23%)` | How full the context window is. |
| `in 1.2M out 34.5k` | Input and output tokens, added up over the session. `/clear` resets them. |
| `$1.23` | What the session has cost so far. |
| `5h 12% (3h 10m)` | Your 5-hour usage limit: the share used, and the time until it resets. |
| `week 34% (2d 4h)` | Your weekly usage limit: the share used, and the time until it resets. |

The limits show only on a Claude subscription. They show `--` until the first reply of the session.

The line updates after each turn, when a limit moves by a whole point, and once a minute so the countdowns stay current.

## Install

Type this at the Claude Code prompt in a terminal:

```
/plugin install usage-status --marketplace aliahmadcse/claude-usage-status
```

Answer `y` to add the marketplace, then choose the user scope so every session loads the mod.

Mods (function hooks) are an early-access Claude Code feature. This mod was built and tested on Claude Code 2.1.296.

If you also have a `statusLine` command in `~/.claude/settings.json`, remove it, or you will see two status lines.

## How it works

The mod is one hooks module, `hooks/register.ts`:

- `session.measure` and a one-minute timer read `$.session.usage()`: the context, the cost, and the `five_hour` and `seven_day` limit windows.
- `turn.step` records the effort of each main-thread request.
- `turn.complete` adds each turn's tokens to totals kept in `$.state`, so they survive a reload.
- `$.ui.status()` pins the line.

All formatting is in `hooks/format.ts`, as pure functions.

## Develop

```bash
claude plugin validate .
claude plugin test .
```

To run a local copy, start Claude Code with `claude --plugin-dir <path to this folder>`.

## License

MIT
