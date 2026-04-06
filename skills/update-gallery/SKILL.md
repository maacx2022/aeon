---
name: Update Gallery
description: Sync articles to the GitHub Pages gallery with proper Jekyll frontmatter
var: ""
tags: [content]
---
> **${var}** — Optional single article filename to sync (e.g. `article-2026-04-01.md`). If empty, syncs all articles.

Publish Aeon's article outputs to the GitHub Pages gallery at `docs/_posts/`.

## Steps

1. Read `memory/MEMORY.md` for context on recent articles.

2. List all markdown files in `articles/` (excluding `.gitkeep` and `feed.xml`):
   ```bash
   ls articles/*.md 2>/dev/null | grep -v feed.xml | sort
   ```

3. For each article file (or just the one in `${var}` if set), process it into a Jekyll post:

   **a) Parse the filename to extract date and slug.**
   Filenames follow patterns like:
   - `article-2026-04-01.md` → date `2026-04-01`, slug `article`
   - `changelog-2026-03-19.md` → date `2026-03-19`, slug `changelog`
   - `repo-actions-2026-03-30.md` → date `2026-03-30`, slug `repo-actions`
   - `token-report-2026-04-02.md` → date `2026-04-02`, slug `token-report`

   The date is the YYYY-MM-DD portion extracted from the filename using regex `([0-9]{4}-[0-9]{2}-[0-9]{2})`.
   The slug is everything before the date pattern, with trailing hyphens removed.

   **b) Extract the title** from the first `# Heading` in the file. If no heading exists, convert the filename slug to title case (e.g., `repo-actions` → `Repo Actions`).

   **c) Determine the category** from the slug:
   - `article`, `research-brief`, `repo-article` → `article`
   - `changelog`, `push-recap`, `code-health` → `changelog`
   - `token-report`, `token-alert`, `defi-overview` → `crypto`
   - `digest`, `rss-digest`, `hacker-news` → `digest`
   - Everything else → `article`

   **d) Check if the article already has Jekyll frontmatter** (starts with `---`). If it does, preserve existing frontmatter and skip re-adding.

   **e) Build the Jekyll post filename:** `docs/_posts/YYYY-MM-DD-<slug>-<sanitized-title-excerpt>.md`
   where the title excerpt is the title lowercased, spaces replaced with hyphens, special chars removed, truncated to 50 chars.

   **f) Write the post file** with this structure:
   ```markdown
   ---
   title: "<extracted title>"
   date: YYYY-MM-DD
   categories: [<category>]
   source_file: "<original-filename>"
   ---
   <article body — everything after the frontmatter if present, or the full content>
   ```

4. After processing all articles, check if any new files were added to `docs/_posts/`:
   ```bash
   git status docs/_posts/
   ```

5. If there are new or changed files, stage and commit them:
   ```bash
   git add docs/_posts/
   git diff --cached --quiet || git commit -m "chore(gallery): sync articles to Jekyll posts $(date +%Y-%m-%d)"
   ```

6. Push to the current branch (main or default):
   ```bash
   git push
   ```

7. Update `memory/logs/${today}.md` with:
   - How many articles were processed
   - How many new posts were added to `docs/_posts/`
   - Any articles that were skipped (already present)

8. Send a notification via `./notify`:
   "Gallery updated: N articles published to GitHub Pages.\n\nhttps://aaronjmars.github.io/aeon"

## Notes

- Jekyll post filenames must start with `YYYY-MM-DD-` and end with `.md`.
- Frontmatter values with colons or special chars must be quoted.
- If an article already exists in `docs/_posts/` (same source_file), skip it unless the source has changed (compare file sizes or first 100 bytes).
- Articles that have no date in their filename: fall back to the git commit date using `git log -1 --format="%as" -- articles/<filename>`.
- Never delete posts from `docs/_posts/` — only add or update.
