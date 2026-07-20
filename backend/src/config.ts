import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  /** Platform fallback when the user has not saved a BYOK key. */
  GROQ_API_KEY: z.string().default(""),
  GROQ_MODEL_LIGHT: z.string().default("openai/gpt-oss-20b"),
  GROQ_MODEL_HEAVY: z.string().default("openai/gpt-oss-120b"),
  PORT: z.coerce.number().int().positive().default(8080),
  // Comma-separated list of allowed browser origins (CORS + WebSocket).
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default(""),
  WHATSAPP_BUSINESS_NUMBER: z.string().default(""),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_BOT_USERNAME: z.string().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(""),
  /** When true, use long-polling instead of (or without) a public webhook. */
  TELEGRAM_USE_POLLING: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const config = loadConfig();

export function getAllowedOrigins(): string[] {
  return config.FRONTEND_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}
