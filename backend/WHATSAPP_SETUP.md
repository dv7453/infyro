# Manual setup (WhatsApp Cloud API)

These steps require clicking through Meta’s consoles and cannot be automated. Complete them before testing the WhatsApp channel. WhatsApp is **optional** — the rest of the agent works without it.

## 1. Create a Meta app and add WhatsApp

1. Open [Meta for Developers](https://developers.facebook.com/) and create an app (type: **Business** is typical).
2. In the app dashboard, add the **WhatsApp** product.
3. Open **WhatsApp → API Setup** (or **Getting started**).

## 2. Phone number

1. Use Meta’s **test WhatsApp Business phone number** for development (free, limited recipients you add as testers), **or**
2. Later, connect a real business number under WhatsApp → Phone numbers.

Add your personal WhatsApp number as a test recipient while using the sandbox number.

## 3. Permanent access token

1. Do **not** rely on the 24-hour temporary token from the quickstart for production/dev longevity.
2. In **Meta Business Settings** → **System users**, create or select a system user.
3. Generate a token with WhatsApp permissions for your app / WhatsApp Business Account (WABA).
4. Copy that token into backend `.env` as `WHATSAPP_ACCESS_TOKEN`.

## 4. Configure the webhook

1. In the WhatsApp product settings, open **Configuration** → **Webhook**.
2. Set:
   - **Callback URL:** `https://<your-backend-domain>/webhooks/whatsapp`  
     For local dev, use a tunnel (e.g. ngrok): `https://<subdomain>.ngrok-free.app/webhooks/whatsapp`
   - **Verify token:** a random string you invent (also set as `WHATSAPP_VERIFY_TOKEN` in `.env`)
3. Subscribe to the **messages** field.
4. Click **Verify and save**. Meta will `GET` your webhook with `hub.verify_token` and `hub.challenge`; the backend returns the challenge when the token matches.

## 5. Note IDs and display number

From WhatsApp → API Setup / Phone numbers, copy:

| Value | Env var |
|-------|---------|
| Phone number ID (used in send API path) | `WHATSAPP_PHONE_NUMBER_ID` |
| WhatsApp Business Account ID | (for Meta console; not required in app env for this build) |
| Human-readable business / test number (e.g. `+1 555 …`) | `WHATSAPP_BUSINESS_NUMBER` (shown later in Settings UI) |

## 6. Database migration

In the Supabase **SQL Editor**, run [`migrations/002_whatsapp.sql`](migrations/002_whatsapp.sql) after `001_initial.sql`.

## 7. Local testing with a tunnel

Meta requires a **public HTTPS** webhook URL.

```bash
# Example with ngrok (install separately)
ngrok http 8080
# Set webhook Callback URL to https://<ngrok-host>/webhooks/whatsapp
```

Then:

1. `POST /api/settings/whatsapp/generate-code` with a logged-in user’s Bearer token.
2. From a linked test WhatsApp account, text that 6-digit code to your WhatsApp Business / test number.
3. You should receive “Connected!” then be able to chat with the agent over WhatsApp.
