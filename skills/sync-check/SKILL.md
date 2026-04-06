---
name: Upstream Sync Check
description: Compare installed skills against upstream aaronjmars/aeon — find outdated and missing skills
var: ""
---
> **${var}** — Upstream repo to check against (default: aaronjmars/aeon).

Today is ${today}. Check whether this Aeon instance's skills are up-to-date with upstream.

## Steps

1. **Determine upstream repo** — use `${var}` if set, otherwise default to `aaronjmars/aeon`.

2. **Fetch upstream skills.json** from GitHub API:
   ```bash
   gh api repos/aaronjmars/aeon/contents/skills.json --jq '.content' | base64 -d > /tmp/upstream-skills.json
   ```

3. **Read local skills.json** at the repo root. If it doesn't exist, run `./generate-skills-json` first.

4. **Compare local vs upstream:**
   - For each upstream skill: check if it exists locally (by slug)
   - If it exists locally and both have `sha` fields: compare SHAs — if different, mark as **outdated**
   - If it doesn't exist locally: mark as **missing**
   - Count how many local skills are **current** (SHA matches upstream or no SHA tracking yet)

5. **Generate sync report** — save to `articles/sync-check-${today}.md`:

   ```
   # Upstream Sync Report — ${today}
   
   **Upstream:** aaronjmars/aeon (or ${var})
   **Local skills:** X | **Upstream skills:** Y
   
   ## Missing Skills (not installed locally)
   | Skill | Description | Install |
   |-------|-------------|---------|
   | name | desc | `./add-skill aaronjmars/aeon slug` |
   
   ## Outdated Skills (different SHA than upstream)
   | Skill | Local SHA | Upstream SHA | Last Updated |
   |-------|-----------|--------------|--------------|
   | name | abc1234 | def5678 | YYYY-MM-DD |
   
   ## Up-to-Date Skills
   X skills are current.
   
   ## How to Sync
   Run `./scripts/sync-upstream.sh` to interactively update outdated skills, or install missing ones with:
   `./add-skill aaronjmars/aeon <slug>`
   ```

6. **Commit the report:**
   ```bash
   git add articles/sync-check-${today}.md
   git commit -m "chore(sync-check): upstream sync report ${today}"
   ```

7. **Send notification** via `./notify` only if there are missing or outdated skills:
   ```
   *Upstream Sync — ${today}*
   
   X skills missing, Y skills outdated vs aaronjmars/aeon.
   
   Missing: [list skill names]
   Outdated: [list skill names]
   
   Run `./scripts/sync-upstream.sh` to update.
   ```
   
   If everything is up to date: no notification needed, just log "All skills current — no notification sent."
