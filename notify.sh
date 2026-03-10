#!/usr/bin/env bash
# Usage: ./notify.sh "Your message here"
# Sends to all configured channels. Silently skips unconfigured ones.
set -euo pipefail

MESSAGE="$1"
SENT=0

# Telegram
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg chat "$TELEGRAM_CHAT_ID" \
      --arg text "$MESSAGE" \
      '{chat_id: $chat, text: $text, parse_mode: "Markdown"}')"
  SENT=$((SENT + 1))
fi

# Discord
if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
  curl -s -X POST "$DISCORD_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg text "$MESSAGE" '{content: $text}')"
  SENT=$((SENT + 1))
fi

# Slack
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg text "$MESSAGE" '{text: $text}')"
  SENT=$((SENT + 1))
fi

if [ "$SENT" -eq 0 ]; then
  echo "No notification channels configured, skipping."
fi
