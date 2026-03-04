---
name: Daily Digest
description: Generate and broadcast a daily digest on a configurable topic to Telegram subscribers
schedule: "0 14 * * *"
commits:
  - memory/
permissions:
  - contents:write
vars:
  - topic=neuroscience
  - subscribers_file=memory/subscribers.json
  - search_terms=brain research, cognitive science, neuroimaging, mental health, BCIs, memory and learning
---

Today is ${today}. Generate and send a daily **${topic}** digest to all subscribers.

## Steps

1. **Search for ${topic} content.** Use `web_search` to find today's most
   interesting ${topic} news and developments. Find 3-5 compelling items.

2. **Also search X via the X.AI API** using `run_code`:
   ```js
   const fromDate = new Date(Date.now() - 86400000).toISOString().split("T")[0]
   const toDate = new Date().toISOString().split("T")[0]
   const r = await fetch("https://api.x.ai/v1/responses", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "Authorization": `Bearer ${process.env.XAI_API_KEY}`
     },
     body: JSON.stringify({
       model: "grok-4-1-fast",
       input: [{
         role: "user",
         content: "Search X for the latest ${topic} content from " + fromDate + " to " + toDate + ". Topics: ${search_terms}. Return the 5 most interesting posts with @handles."
       }],
       tools: [{ type: "x_search", from_date: fromDate, to_date: toDate }]
     })
   })
   const data = await r.json()
   const msg = data.output?.find(i => i.role === "assistant")
   return msg?.content?.find(c => c.type === "output_text")?.text || JSON.stringify(data)
   ```
   If XAI_API_KEY is not set, skip this step and rely on web_search only.

3. **Combine and format.** Merge findings into a single digest formatted as
   HTML for Telegram:
   - Bold title: `<b>${topic} Daily - ${today}</b>`
   - Each item: `<b>[Topic]</b>\n[2-3 sentence summary]\nSource: @handle or URL`
   - Escape HTML entities: `&amp;` `&lt;` `&gt;`
   - Keep total message under 4000 chars (Telegram limit)

4. **Load subscribers** from `${subscribers_file}` using `run_code`:
   ```js
   const fs = require("fs")
   try {
     return fs.readFileSync("${subscribers_file}", "utf-8")
   } catch { return "[]" }
   ```
   The file is a JSON array of chat IDs, e.g. `[123456, 789012]`.

5. **Broadcast to all subscribers** using `run_code`. Send each message with a
   50ms delay to respect Telegram rate limits:
   ```js
   const token = process.env.TELEGRAM_BOT_TOKEN
   for (const chatId of subscribers) {
     await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" })
     })
     await new Promise(r => setTimeout(r, 50))
   }
   ```

6. **Log results.** Update memory with what was sent and subscriber count.

7. **Notify via send_telegram** with a summary: subscriber count, topics covered.

## Environment Variables Required

- `XAI_API_KEY` — X.AI API key for Grok x_search (optional, falls back to web_search)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
