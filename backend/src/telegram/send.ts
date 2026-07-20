import { config } from "../config.js";

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<void> {
  const token = config.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram is not configured (TELEGRAM_BOT_TOKEN)");
  }

  // Telegram text limit ~4096; chunk if needed.
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, 4000));
    remaining = remaining.slice(4000);
  }
  if (chunks.length === 0) return;

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram send failed (${response.status}): ${body}`);
    }
  }
}
