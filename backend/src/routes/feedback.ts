import { Router } from "express";
import { z } from "zod";
import { insertFeedback } from "../db/feedback.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const feedbackRouter = Router();

const submitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(5000),
});

feedbackRouter.post("/", requireAuth, async (req, res) => {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Name and message are required" });
      return;
    }

    const user = (req as AuthedRequest).user;
    const email = user.email?.trim();
    if (!email) {
      res.status(400).json({ message: "Signed-in account has no email" });
      return;
    }

    const row = await insertFeedback({
      userId: user.id,
      email,
      name: parsed.data.name,
      message: parsed.data.message,
    });

    res.status(201).json({
      id: row.id,
      email: row.email,
      name: row.name,
      message: row.message,
      created_at: row.created_at,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit feedback";
    res.status(500).json({ message });
  }
});
