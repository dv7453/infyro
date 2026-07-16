/** UI constants for agent creation (not mock API data). */

export const AGENT_COLORS = [
  { name: "Indigo", value: "#4F46E5" },
  { name: "Emerald", value: "#10B981" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Sky", value: "#0EA5E9" },
  { name: "Violet", value: "#8B5CF6" },
];

export const PERSONA_PRESETS = [
  {
    key: "straight",
    title: "Straight",
    blurb: "Facts first. Short and clear.",
    text: "Give me a short, factual update. No fluff. Numbers first.",
  },
  {
    key: "careful",
    title: "Careful",
    blurb: "Cautious. Flags risk clearly.",
    text: "Explain what's happening and what could go wrong. If unsure, say so.",
  },
  {
    key: "friendly",
    title: "Friendly",
    blurb: "Warm. Explains like a friend.",
    text: "Talk to me like a friend. Explain simply. Give context.",
  },
];
