# Fish tank — `dsh-superagent-intervention`

Shows the real running task sessions below the composer as groups of fish, each group with a Stop now button, and writes the real stop receipt into the panel.

## What it does

- **Stop a group / one fish.** Two clicks: *Stop now* then confirm. The panel records the receipt (pending → notified → completed).
- **Redirect a fish.** Change a fish's direction mid-task (via chat steer); the fish follows the new direction with context intact.
- **Ask one fish.** Click *Ask* on the fish's row; the question goes to the captain's receipt and the answer is shown in the panel.

## Measured

- Panel stop a group: 8/8. Panel stop one fish: 7/8 (one point off on "no rework": a stopped fish never resumes — the captain dispatches a new fish to finish from the draft).
- Ask: plugin 8/8 vs native 5/8 (plugin wins on findability and knowing the result; real mid-task ask).
- Chat one-sentence stop does **not** work mid-task (4 pieces of evidence): the message queues and only runs after the fish finishes. The panel button is the only reliable mid-task entry.

## Requires

DSH 0.2.2-rc.5, `web` profile. Injects into `@deepseek-ai/dsh-client-ui-conversation`.
