# Manual setup (Telegram bot)

Telegram linking uses a **bot + 6-digit code**. No phone number is required — chats are identified by Telegram `chat_id`.

Telegram is **optional**. The web agent works without it.

## 1. Create a bot with BotFather

1. Open Telegram and chat with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts (display name + username ending in `bot`).
3. Copy the **HTTP API token** → `TELEGRAM_BOT_TOKEN` in `backend/.env`.
4. Copy the bot username (without `@`) → `TELEGRAM_BOT_USERNAME`.

## 2. Database migration

In the Supabase **SQL Editor**, run [`migrations/004_telegram.sql`](migrations/004_telegram.sql).

## 3. Local development (recommended: polling)

For local testing you do **not** need a public HTTPS URL.

In `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_BOT_USERNAME=YourBotUsername
TELEGRAM_USE_POLLING=true
```

Restart the backend. You should see `Telegram long-polling started`.

## 4. Production / webhook (optional)

When you have a public HTTPS backend:

1. Set `TELEGRAM_USE_POLLING=false`.
2. Optionally set a random `TELEGRAM_WEBHOOK_SECRET`.
3. Register the webhook (replace values):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-backend>/webhooks/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
  -d "allowed_updates=[\"message\"]"
```

Local tunnels work too (e.g. ngrok → `https://xxx.ngrok-free.app/webhooks/telegram`).

## 5. Link a chat

1. Sign in to Infyro → **Settings → Telegram**.
2. Click **Generate code** (valid 10 minutes).
3. Either:
   - Open the deep link shown (`t.me/YourBot?start=CODE`), or
   - Message your bot and send the 6-digit code.
4. Bot replies **Connected!** — then chat normally with the agent.
5. For confirmations, reply `yes` / `no`.

## 6. Unlink

In Settings → Telegram → **Unlink**, or delete the row from `telegram_links` in Supabase.
