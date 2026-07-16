/** Open Infyro's Telegram bot (works with mobile/desktop Telegram apps). */
export function openTelegramUrl(url) {
  if (!url) return false;
  // Prefer navigating a hidden anchor — more reliable than window.open with pop-up blockers.
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function botChatUrl(username, startPayload) {
  const u = String(username || "InfyroMarketBot").replace(/^@/, "");
  if (startPayload) {
    return `https://t.me/${u}?start=${encodeURIComponent(startPayload)}`;
  }
  return `https://t.me/${u}`;
}
