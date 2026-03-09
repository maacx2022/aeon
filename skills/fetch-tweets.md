---
name: Fetch Tweets
description: Fetch 10 random tweets from a given X user using the X.AI API
vars:
  - username=elonmusk
---

Today is ${today}. Fetch 10 random tweets from **@${username}** on X.

## Steps

1. **Fetch tweets via X.AI API** using curl:
   ```bash
   curl -s -X POST "https://api.x.ai/v1/responses" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $XAI_API_KEY" \
     -d '{
       "model": "grok-4-1-fast",
       "input": [{"role": "user", "content": "Search X for tweets from:${username}. Return exactly 10 tweets - pick a random mix, not just the most recent. For each tweet include: the full text, date posted, and the direct link (https://x.com/${username}/status/ID). Return as a numbered list."}],
       "tools": [{"type": "x_search"}]
     }'
   ```
   Parse the response JSON to extract the assistant's output text.

2. **Save the results** to `memory/tweets-${username}-${today}.md`.

3. **Log to memory** what was fetched.

4. **Send a notification via `tools/notify.sh`** with a quick summary of the 10 tweets.

## Environment Variables Required

- `XAI_API_KEY` — X.AI API key (required)
