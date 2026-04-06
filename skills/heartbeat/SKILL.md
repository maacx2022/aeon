---
name: Heartbeat
description: Proactive ambient check — surface anything worth attention
var: ""
tags: [meta]
---
> **${var}** — Area to focus on. If empty, runs all checks.

If `${var}` is set, focus checks on that specific area.

Read memory/MEMORY.md and the last 2 days of memory/logs/ for context.

## Checks (in priority order)

### P0 — Failed & stuck skills (check first)

Read `memory/cron-state.json`. This file tracks every scheduled skill's state:
```json
{
  "skill-name": {
    "last_dispatch": "2026-04-06T12:00:00Z",
    "last_status": "dispatched|success|failed",
    "last_success": "2026-04-06T12:05:00Z",
    "last_failed": "2026-04-05T12:03:00Z"
  }
}
```

Flag these conditions:
- **Failed skills**: any entry with `last_status: "failed"`. Report the skill name and when it failed.
- **Stuck skills**: any entry with `last_status: "dispatched"` where `last_dispatch` is **>45 minutes ago**. The skill was dispatched but never reported back — likely hung or crashed before the state update step ran.
- **Self-check**: if heartbeat's own entry shows `last_success` is **>36 hours ago** (or missing), note that heartbeat itself may be unreliable.

### P1 — Stalled PRs & urgent issues

- [ ] Any open PRs stalled > 24h? (use `gh pr list`)
- [ ] Any GitHub issues labeled urgent? (use `gh issue list`)

### P2 — Flagged memory items

- [ ] Anything flagged in memory/MEMORY.md that needs follow-up?

### P3 — Missing scheduled skills

Read `aeon.yml` for enabled skills with schedules. Cross-reference with `memory/cron-state.json`:
- If an enabled skill has **no entry at all** in the state file, it has never been dispatched by the scheduler.
- If a skill's `last_success` is **>2x its schedule interval** old (e.g., a daily skill hasn't succeeded in >48h), flag it.

Do NOT use `gh run list` for this — the state file is authoritative.

## Dedup & notification

Before sending any notification, grep memory/logs/ for the same item. If it appears in the last 48h of logs, skip it. Never notify about the same item twice.

Batch all findings into a **single notification**, grouped by priority tier:
```
🔴 FAILED: skill-a (failed 2h ago), skill-b (stuck 1h ago)
🟡 STALLED: PR #42 open 3 days
🔵 MEMORY: follow-up on X flagged 2 days ago
```

## Output

If nothing needs attention, log "HEARTBEAT_OK" and end your response.

If something needs attention:
1. Send a single concise notification via `./notify` (grouped by priority as above)
2. Log the findings and actions taken to memory/logs/${today}.md
