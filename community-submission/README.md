# Super Agent Plugin Pack for DeepSeek Harness

**Supervise your agents while they work — stop, redirect, ask, take over — and a background caretaker that watches your fish and fixes silent failures.**

While a DeepSeek Harness agent team is writing for you, you can always reach the fish you want, and it listens the moment you speak. This pack adds three plugins to DSH: an intervention panel (fish tank), a takeover panel, and a background caretaker. No separate app — Super Agent UI is DSH plugins.

> Status: tested on DSH 0.2.2-rc.5. The DSH plugin API is a developer preview and interfaces may change; pin the DSH version below. Real-user evidence is indirect so far (scripted tasks on real DSH); see [Honest limits](#honest-limits).

## What is inside

| Plugin | Panel | What it does | Measured result |
|---|---|---|---|
| `dsh-superagent-intervention` — Fish tank | Fish tank | Stop a group of fish / one fish, redirect a fish, ask a fish one question mid-task; receipts written into the panel | Panel stop group 8/8, stop one fish 7/8, ask 8/8 vs native 5/8 |
| `dsh-superagent-takeover` — Takeover | Takeover | Stop a fish, edit its file yourself, tell the captain to resume with a new fish | P-A 8/8, P-B 8/8 vs native 0/8, 5/8 |
| `dsh-superagent-caretaker` — Caretaker | None (background) | Every 10 s heartbeat: judges whether a fish is stalled (lost config R7, drifted R4, nothing delivered R1/R6), repairs what it can, posts a plain-language diagnosis to the captain | 37 judgments, 0 errors; R7 4/4, R4 5/5 |

## Install

Requires DSH 0.2.2-rc.5 (or the same series) with a model configured.

```bash
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-intervention'
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-takeover'
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-caretaker'
```

Restart DSH afterwards. If an old test build `@local/takeover-spike` is still installed, remove it first or you will see two takeover panels:

```bash
dsh plugin --profile web remove @local/takeover-spike
```

## How to use

1. **Intervention (fish tank panel).** After the captain dispatches fish on a long task, the panel appears below the composer, grouped by goal. Each fish is one row: *Stop now* (whole group or one fish), *Ask one question* (ask that fish; the answer lands in the captain's receipt).
2. **Takeover (takeover panel).** Click *Stop fish*, edit the fish's file on disk (or just change direction), click *Receipt: wait for me* so the captain does not dispatch a replacement yet, then click *Receipt: done* — the captain dispatches a new fish that continues from where you edited. A stopped fish can never be called back; hand-back always means a new fish.
3. **Caretaker (no UI).** Write a watch file `~/workspace/dsh-care/caretaker-watch.json` — one entry per fish with the fish session id, captain session id, task, target file, config file and backup. The heartbeat reads it every 10 s, repairs what it can (restores a lost config from backup for R7; directs a rewrite for R4), and posts the diagnosis to the captain session. State files live under `<DSH_HOME>/caretaker-state/<watchId>.json`.

## Design constraints (measured, do not work around them)

- **Talk to the captain only via receipt append, never `session.prompt()`.** In takeover, `session.prompt()` falsely reports `answered` while the message never lands in the captain session (reproduced 2/2). There is no prompt button in the takeover panel.
- **A stopped fish never resumes.** Hand-back = the captain dispatches a new fish. Receipt wording must say "dispatch a new fish and continue from where I edited", never "call the fish back".
- **The caretaker cannot repair R1.** A Host plugin cannot get a session controller, so "wake the fish and redo" does not work; only R4 has a "generate + write + re-judge" repair path. R7 is repaired from backup.
- **Token cost cannot be measured.** `deriveMessages()` exposes no token usage — only rounds and characters. No token numbers are claimed anywhere in this pack.

## Honest limits

- Real-user behavior evidence is indirect: all numbers come from scripted tasks run on real DSH, not from real users. Frequency of intervention and how it feels are unmeasured.
- The caretaker hypothesis only partly holds: its proven value is catching silent state loss (R7), not judging content drift; it does not beat the alternatives on wasted rounds. Rules R1/R2/R3/R5 have no clean stalled-fish evidence yet, and the plugin does not implement R2/R3/R5 checks.
- A stopped fish's wording is not preserved: the new fish keeps the content but rewrites the phrasing.
- The caretaker needs a hand-written watch JSON; there is no UI to add a watch yet.
- The "Ask one question" dialog uses `window.prompt` (minimal implementation); the captain answers from disk files, not by asking the fish session directly.

## Permissions

These plugins run with your own DSH permissions: they read and write files in your workspace, stop sessions, and append receipts to the captain session. They make no network calls and use no external services. Check the source before installing, as with any DSH plugin.

## Compatibility

- DSH 0.2.2-rc.5 (tested). The plugin API is a developer preview; pin this version range.
- Profile: `web` (tested). Desktop profile untested.

## License

MIT — see [LICENSE](LICENSE).

## Source

- One-room Studio （一间工作室）. Issues and pull requests welcome.
- Demo: clean re-run v02 (2026-11-21) proved takeover full path, mid-task ask of the right fish, and intervention stop of a running fish — see `screenshots/`.
