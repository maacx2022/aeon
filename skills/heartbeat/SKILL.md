---
name: Heartbeat
description: Proactive ambient check — surface anything worth attention
---

Read memory/MEMORY.md and the last 2 days of memory/logs/ for context.

Check the following:
- [ ] Any open PRs stalled > 24h? (use `gh pr list` to check)
- [ ] Anything flagged in memory that needs follow-up?
- [ ] Check recent GitHub issues for anything labeled urgent (use `gh issue list`)
- [ ] Scan aeon.yml for scheduled skills — cross-reference with recent logs to find any that haven't run when expected

Before sending any notification, grep memory/logs/ for the same item. If it appears in the last 48h of logs, skip it. Never notify about the same item twice.

If nothing needs attention, log "HEARTBEAT_OK" and end your response.

If something needs attention:
1. Send a concise notification via `notify.sh`
2. Log the finding and action taken to memory/logs/${today}.md
