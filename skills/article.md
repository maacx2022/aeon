---
name: Daily Article
description: Research trending topics and write a publication-ready article
---

Today is ${today}. Your task is to research and write a high-quality article.

Steps:
1. Read `memory/MEMORY.md` for context on what topics have been covered recently.
2. Search the web for the most interesting recent developments in AI, crypto/DeFi,
   or consciousness research — pick whichever has the most compelling story today.
   Use Claude Code's built-in WebSearch. If it fails or returns thin results, fall back to `tools/web-search.sh`.
3. Read 2-3 source articles to gather facts and quotes. Use WebFetch (fall back to `tools/fetch-url.sh`).
4. Write a 600-800 word article in markdown. Include:
   - A compelling title
   - A short intro hook
   - 3-4 substantive sections
   - Cited sources at the bottom
5. Save the article to: articles/${today}.md
6. Update memory/MEMORY.md to record that this article was written and its topic.
7. Log what you did to memory/logs/${today}.md.
8. Send a notification via `tools/notify.sh`: "New article written: [title]\n\nhttps://github.com/${repo}/blob/main/articles/${today}.md"

Write complete, publication-ready content. No placeholders.
