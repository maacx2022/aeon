// Telegram webhook handler for subscriber management (/start, /stop, /help)
// Stores subscribers in memory/subscribers.json in the repo via GitHub API.
// Deploy to Vercel. Set env vars: TELEGRAM_BOT_TOKEN, GITHUB_TOKEN, GITHUB_REPO (owner/repo).

import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUBS_PATH = "memory/subscribers.json";

const tg = (method: string, body: object) =>
  fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const gh = (path: string, opts: RequestInit = {}) =>
  fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      ...opts.headers,
    },
  });

async function loadSubscribers(): Promise<{ ids: number[]; sha: string | null }> {
  const r = await gh(SUBS_PATH);
  if (!r.ok) return { ids: [], sha: null };
  const data = await r.json() as { content: string; sha: string };
  const ids = JSON.parse(Buffer.from(data.content, "base64").toString());
  return { ids, sha: data.sha };
}

async function saveSubscribers(ids: number[], sha: string | null) {
  const content = Buffer.from(JSON.stringify(ids, null, 2)).toString("base64");
  await gh(SUBS_PATH, {
    method: "PUT",
    body: JSON.stringify({
      message: "update subscribers",
      content,
      ...(sha ? { sha } : {}),
    }),
  });
}

const WELCOME = `<b>Welcome to the Daily Digest!</b>

You'll receive a curated digest every morning.

<i>Reply /stop anytime to unsubscribe.</i>`;

const HELP = `<b>Daily Digest Bot</b>

/start - Subscribe to daily updates
/stop - Unsubscribe
/help - Show this message`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const msg = req.body?.message;
  if (!msg?.text || !msg.chat) return res.json({ ok: true });

  const chatId: number = msg.chat.id;
  const text = msg.text.trim().toLowerCase();
  const name = msg.from?.first_name || "there";

  const { ids, sha } = await loadSubscribers();

  switch (text) {
    case "/start": {
      if (ids.includes(chatId)) {
        await tg("sendMessage", { chat_id: chatId, text: "You're already subscribed! /stop to unsubscribe.", parse_mode: "HTML" });
      } else {
        ids.push(chatId);
        await saveSubscribers(ids, sha);
        await tg("sendMessage", { chat_id: chatId, text: WELCOME.replace("Welcome", `Welcome, ${name}`), parse_mode: "HTML" });
      }
      break;
    }
    case "/stop":
    case "/unsubscribe": {
      const idx = ids.indexOf(chatId);
      if (idx >= 0) {
        ids.splice(idx, 1);
        await saveSubscribers(ids, sha);
        await tg("sendMessage", { chat_id: chatId, text: "Unsubscribed. Reply /start to resubscribe.", parse_mode: "HTML" });
      } else {
        await tg("sendMessage", { chat_id: chatId, text: "You're not subscribed. Reply /start to subscribe.", parse_mode: "HTML" });
      }
      break;
    }
    case "/help":
      await tg("sendMessage", { chat_id: chatId, text: HELP, parse_mode: "HTML" });
      break;
    default:
      if (text.startsWith("/")) {
        await tg("sendMessage", { chat_id: chatId, text: "Unknown command. /help for options.", parse_mode: "HTML" });
      }
  }

  return res.json({ ok: true });
}
