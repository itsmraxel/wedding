import { v } from "convex/values";
import { action, internalAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Kapso is a thin proxy over Meta's WhatsApp Cloud API. We send personalized
// free-form text messages; that requires the recipient to have an open 24h
// conversation window (i.e. they messaged the Business number recently).
// Outside that window WhatsApp rejects the message and we record it as failed.
//
// Configure with:
//   npx convex env set KAPSO_API_KEY <project-api-key>
//   npx convex env set KAPSO_PHONE_NUMBER_ID <whatsapp-business-phone-number-id>

const KAPSO_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";

// POST one text message to Kapso. Returns the WhatsApp message id on success,
// throws with a human-readable reason otherwise.
async function postText(to: string, body: string): Promise<string> {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!apiKey || !phoneNumberId) {
    throw new Error(
      "Kapso isn't configured — set KAPSO_API_KEY and KAPSO_PHONE_NUMBER_ID."
    );
  }
  const digits = to.replace(/\D/g, "");
  if (!digits) throw new Error("Recipient has no phone number.");

  let res: Response;
  try {
    res = await fetch(`${KAPSO_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "text",
        text: { body, preview_url: true },
      }),
    });
  } catch (e) {
    throw new Error(
      `Couldn't reach Kapso: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string };
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? data?.message ?? `Kapso error ${res.status}`
    );
  }
  return data?.messages?.[0]?.id ?? "";
}

// Send a single queued message and record the outcome. Shared by the batch
// action and the scheduled auto-send path.
async function deliver(
  ctx: ActionCtx,
  sendId: Id<"sends">
): Promise<{ ok: boolean; error?: string }> {
  const info = await ctx.runQuery(internal.sends.getForDelivery, { sendId });
  if (!info) return { ok: false, error: "Send not found" };
  if (info.status === "sent") return { ok: true };

  await ctx.runMutation(internal.sends.setDeliveryStatus, {
    sendId,
    status: "sending",
  });
  try {
    const providerMessageId = await postText(info.phone, info.body);
    await ctx.runMutation(internal.sends.setDeliveryStatus, {
      sendId,
      status: "sent",
      providerMessageId,
    });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await ctx.runMutation(internal.sends.setDeliveryStatus, {
      sendId,
      status: "failed",
      error,
    });
    return { ok: false, error };
  }
}

// Public: send a specific set of queued messages now (used by the "Send all"
// button on the Messages page, and for retrying failed rows).
export const sendBatch = action({
  args: { sendIds: v.array(v.id("sends")) },
  handler: async (ctx, { sendIds }) => {
    let sent = 0;
    let failed = 0;
    const results: { sendId: Id<"sends">; ok: boolean; error?: string }[] = [];
    for (const sendId of sendIds) {
      const result = await deliver(ctx, sendId);
      if (result.ok) sent++;
      else failed++;
      results.push({ sendId, ok: result.ok, error: result.error });
    }
    return { sent, failed, results };
  },
});

// Internal: send every still-pending message for a fired campaign. Scheduled
// by `scheduled.fire` when the campaign has autoSend enabled.
export const sendCampaign = internalAction({
  args: { scheduledMessageId: v.id("scheduledMessages") },
  handler: async (ctx, { scheduledMessageId }) => {
    const sendIds: Id<"sends">[] = await ctx.runQuery(
      internal.sends.pendingForCampaign,
      { scheduledMessageId }
    );
    for (const sendId of sendIds) {
      await deliver(ctx, sendId);
    }
    return null;
  },
});
