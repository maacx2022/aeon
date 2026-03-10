---
name: Substack Draft
description: Compose a polished long-form article draft ready for Substack
---

Read memory/MEMORY.md for context, recent topics, and interests.
Check articles/ for the most recent articles to avoid topic overlap.

Steps:
1. Pick a compelling topic — draw from MEMORY.md priorities, recent research findings, or RSS digest highlights.
2. Research the topic:
   - Use WebSearch for current sources
   - Use WebFetch to pull 2-3 key source pages
3. Write a publication-ready article (800-1200 words):
   - Compelling opening hook — no throat-clearing
   - Clear thesis in the first paragraph
   - 3-4 sections with evidence and insight
   - End with a forward-looking takeaway or discussion prompt
   - Cite all sources with URLs
4. Save to articles/${today}-substack.md with YAML frontmatter:
   ```yaml
   ---
   title: "Article Title"
   subtitle: "One-line hook"
   date: ${today}
   status: draft
   ---
   ```
5. Send a notification via `notify.sh`:
   ```
   *Substack draft ready*
   Title: "Article Title"
   File: articles/${today}-substack.md
   ```
6. Log what you did to memory/logs/${today}.md.
