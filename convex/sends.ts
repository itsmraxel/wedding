import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const eventKey = v.union(v.literal("traditional"), v.literal("white"));

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
    // Close out the campaign once every queued message is sent.
    const send = await ctx.db.get(sendId);
    if (send?.scheduledMessageId) {
      const siblings = await ctx.db
        .query("sends")
        .withIndex("by_scheduled", (q) =>
          q.eq("scheduledMessageId", send.scheduledMessageId)
        )
        .collect();
      if (siblings.every((s) => s.status === "sent")) {
        await ctx.db.patch(send.scheduledMessageId, { status: "done" });
      }
    }
  },
});

// Undo for an accidental auto-mark when the wa.me tab was opened.
export const unmarkSent = mutation({
  args: { sendId: v.id("sends") },
  handler: async (ctx, { sendId }) => {
    const send = await ctx.db.get(sendId);
    if (!send) return;
    await ctx.db.patch(sendId, { status: "pending" });
    if (send.scheduledMessageId) {
      const campaign = await ctx.db.get(send.scheduledMessageId);
      if (campaign && campaign.status === "done") {
        await ctx.db.patch(send.scheduledMessageId, { status: "due" });
      }
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
