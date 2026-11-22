# Caretaker — `dsh-superagent-caretaker`

A resident background worker that watches task sessions, judges stalled fish, repairs what it can, and posts plain-language diagnoses to the captain.

## What it does

Every 10 s the heartbeat reads your watch file and judges each watched fish against seven rules (R1 nothing delivered, R2 spinning, R3 looping, R4 drifted off target, R5 burning budget, R6 silent failure, R7 config lost). When it finds a problem it repairs what it can — restores a lost config from backup (R7), directs a rewrite (R4) — and posts a plain-language diagnosis as a receipt on the captain session. It never asks the user anything (0 disturbances measured).

## Setup

Write a watch file at `~/workspace/dsh-care/caretaker-watch.json`. One entry per fish: fish session id, captain session id, task, target file, config file and its backup. State files live under `<DSH_HOME>/caretaker-state/<watchId>.json`. There is no UI to add a watch yet — the file is hand-written for now.

## Measured

- 37 judgments, 0 misjudgments (WOZ 24 + test build 9 + clean-stall 4).
- R7 (config lost): 4/4 correct — detected, restored, verified 10/10.
- R4 (drift): 5/5 correct in test build; first natural drift caught in clean-stall verification.
- Good-fish control: 0 false kills (3 good fish).
- A/B/C comparison: the hypothesis only partly holds — proven value is catching silent state loss (R7), not judging content drift; no win on wasted rounds.

## Honest limits

- R1/R2/R3/R5 have no clean stalled-fish evidence yet, and the plugin does not implement R2/R3/R5 checks.
- The repair is a compromise under the plugin API: the caretaker generates the plan text itself, writes it to disk and re-verifies — "wake the fish and redo" is impossible because a Host plugin cannot get a session controller.
- Token cost cannot be measured: DSH sessions expose no token usage, only rounds and characters.
- Receipts only land while the captain session is live; with the browser closed the captain never sees the diagnosis.

## Requires

DSH 0.2.2-rc.5, `web` profile. Host-only, no UI.
