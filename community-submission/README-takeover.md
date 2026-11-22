# Takeover — `dsh-superagent-takeover`

Take over a fish's work: stop the fish, edit the file yourself, and tell the captain to resume with a new fish.

## What it does

1. **Stop the fish** — pick the fish's row and stop it (its running turn is aborted).
2. **Edit its file yourself** — change the file on disk, or just change direction.
3. **Receipt: wait for me** — tells the captain not to dispatch a replacement yet.
4. **Receipt: done** — the captain dispatches a new fish that continues from where you edited. Your edits are kept and carried out by the new fish.

## Measured

- Takeover by doing (stop → edit → new fish continues): plugin 8/8 vs native 0/8 (native cannot stop the fish; the captain reverts all user edits as "tampering").
- Takeover by commanding (user directs, relayed via captain): plugin 8/8 vs native 5/8.
- Trigger is "the user wants to add / change something", not "the fish is stuck".

## Hard constraints (measured)

- Talk to the captain only via receipt append. `session.prompt()` falsely reports `answered` in this scenario (message never lands) — there is no prompt button in this panel.
- A stopped fish can never be called back. Hand-back always means a new fish. Receipt wording must say "dispatch a new fish and continue from where I edited".

## Requires

DSH 0.2.2-rc.5, `web` profile. Injects into `@deepseek-ai/dsh-client-ui-conversation`.
