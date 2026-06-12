"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";

// FUTURE: integrate Kapso (WhatsApp Cloud API wrapper) here.
// Requires: Kapso API key, a pre-approved Meta message template (utility category),
// recipient opt-in, and STOP handling. Convex `action` (not mutation/query) makes the
// outbound HTTP call; schedule reminders with ctx.scheduler.runAt / cron.
// For now the app sends via wa.me links from the operator's own WhatsApp.
export const sendViaKapso = action({
  args: {
    contactId: v.id("contacts"),
    body: v.string(),
  },
  handler: async () => {
    throw new Error(
      "Kapso sending is not wired up yet — use the wa.me links on the Messages page."
    );
  },
});
