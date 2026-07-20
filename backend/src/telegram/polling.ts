import { config } from "../config.js";
import { processTelegramIncoming } from "./handler.js";

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { username?: string };
  };
};

/**
 * Long-polling for local development (no public HTTPS webhook required).
 * Enable with TELEGRAM_USE_POLLING=true.
 */
export function startTelegramPolling(): void {
  const token = config.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("Telegram polling skipped: TELEGRAM_BOT_TOKEN is empty");
    return;
  }

  let offset = 0;
  let stopped = false;

  console.log("Telegram long-polling started");

  async function loop() {
    while (!stopped) {
      try {
        const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
        url.searchParams.set("timeout", "30");
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

        const response = await fetch(url, { method: "GET" });
        if (!response.ok) {
          const body = await response.text();
          console.error("Telegram getUpdates failed:", response.status, body);
          await sleep(3000);
          continue;
        }

        const json = (await response.json()) as {
          ok: boolean;
          result?: TelegramUpdate[];
        };
        for (const update of json.result ?? []) {
          offset = update.update_id + 1;
          const message = update.message;
          const chatId = message?.chat?.id;
          if (chatId == null) continue;

          void processTelegramIncoming({
            chatId: String(chatId),
            text: message?.text ?? null,
            username: message?.from?.username ?? null,
          }).catch((err) => {
            console.error("Telegram poll message failed:", err);
          });
        }
      } catch (err) {
        console.error("Telegram polling error:", err);
        await sleep(3000);
      }
    }
  }

  void loop();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
