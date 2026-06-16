import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import { Id } from "./_generated/dataModel";

const eventKey = v.union(v.literal("traditional"), v.literal("white"));

// A campaign is finished once none of its sends are still waiting to go out.
// "pending" (manual queue) and "sending" (handed to Kapso) are the only
// non-terminal states; "sent" and "failed" both count as resolved.
async function maybeCompleteCampaign(
  ctx: MutationCtx,
  scheduledMessageId: Id<"scheduledMessages">
) {
  const campaign = await ctx.db.get(scheduledMessageId);
  if (!campaign) return;
  const siblings = await ctx.db
    .query("sends")
    .withIndex("by_scheduled", (q) =>
      q.eq("scheduledMessageId", scheduledMessageId)
    )
    .collect();
  const settled = siblings.every(
    (s) => s.status === "sent" || s.status === "failed"
  );
  if (settled && campaign.status === "due") {
    await ctx.db.patch(scheduledMessageId, { status: "done" });
  } else if (!settled && campaign.status === "done") {
    await ctx.db.patch(scheduledMessageId, { status: "due" });
  }
}

export const logSends = mutation({
  args: {
    recipients: v.array(
      v.object({ contactId: v.id("contacts"), body: v.string() })
    ),
    channel: v.union(v.literal("wa_link"), v.literal("kapso")),
    eventKey: v.optional(eventKey),
  },
  handler: async (ctx, { recipients, channel, eventKey }) => {
    const ids = [];
    for (const recipient of recipients) {
      ids.push(
        await ctx.db.insert("sends", {
          contactId: recipient.contactId,
          body: recipient.body,
          eventKey,
          channel,
          status: "pending",
          createdAt: Date.now(),
        })
      );
    }
    return ids;
  },
});

export const markSent = mutation({
  args: { sendId: v.id("sends") },
  handler: async (ctx, { sendId }) => {
    await ctx.db.patch(sendId, { status: "sent" });
    const send = await ctx.db.get(sendId);
    if (send?.scheduledMessageId) {
      await maybeCompleteCampaign(ctx, send.scheduledMessageId);
    }
  },
});

// Undo for an accidental auto-mark when the wa.me tab was opened.
export const unmarkSent = mutation({
  args: { sendId: v.id("sends") },
  handler: async (ctx, { sendId }) => {
    const send = await ctx.db.get(sendId);
    if (!send) return;
    await ctx.db.patch(sendId, { status: "pending", error: undefined });
    if (send.scheduledMessageId) {
      await maybeCompleteCampaign(ctx, send.scheduledMessageId);
    }
  },
});

/* ---------- Automated (Kapso) delivery plumbing ---------- */

// Read a single send plus the recipient's phone, for the Kapso action.
export const getForDelivery = internalQuery({
  args: { sendId: v.id("sends") },
  handler: async (ctx, { sendId }) => {
    const send = await ctx.db.get(sendId);
    if (!send) return null;
    const contact = await ctx.db.get(send.contactId);
    return {
      sendId: send._id,
      body: send.body,
      status: send.status,
      phone: contact?.phone ?? "",
      name: contact?.name ?? "(deleted)",
    };
  },
});

// Every send for a campaign that hasn't gone out yet (for "send all").
export const pendingForCampaign = internalQuery({
  args: { scheduledMessageId: v.id("scheduledMessages") },
  handler: async (ctx, { scheduledMessageId }) => {
    const sends = await ctx.db
      .query("sends")
      .withIndex("by_scheduled", (q) =>
        q.eq("scheduledMessageId", scheduledMessageId)
      )
      .collect();
    return sends
      .filter((s) => s.status === "pending" || s.status === "failed")
      .map((s) => s._id);
  },
});

// Record the outcome of a Kapso send attempt.
export const setDeliveryStatus = internalMutation({
  args: {
    sendId: v.id("sends"),
    status: v.union(
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed")
    ),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { sendId, status, providerMessageId, error }) => {
    const send = await ctx.db.get(sendId);
    if (!send) return;
    await ctx.db.patch(sendId, {
      status,
      // Clear any stale error when a retry starts or succeeds.
      error: status === "failed" ? error : undefined,
      ...(providerMessageId ? { providerMessageId } : {}),
    });
    if (send.scheduledMessageId && status !== "sending") {
      await maybeCompleteCampaign(ctx, send.scheduledMessageId);
    }
  },
});

export const recentSends = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const sends = await ctx.db.query("sends").order("desc").take(limit ?? 6);
    return await Promise.all(
      sends.map(async (send) => {
        const contact = await ctx.db.get(send.contactId);
        return { ...send, contactName: contact?.name ?? "(deleted)" };
      })
    );
  },
});
