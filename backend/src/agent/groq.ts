import OpenAI from "openai";
import { config } from "../config.js";

export const groq = new OpenAI({
  apiKey: config.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export function getLightModel(): string {
  return config.GROQ_MODEL_LIGHT;
}

export function getHeavyModel(): string {
  return config.GROQ_MODEL_HEAVY;
}
