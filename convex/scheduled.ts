import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

const eventKey = v.union(v.literal("traditional"), v.literal("white"));
const kind = v.union(
  v.literal("invite"),
  v.literal("reminder"),
  v.literal("guide"),
  v.literal("custom")
);

// Guest-facing links are built against this origin. Override with
// `npx convex env set SITE_URL https://your-domain` for production.
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

// Resolves one personalized pending send per contact for a campaign.
// Undecided guests get the wedding-choice link appended to invites.
async function queueSendsFor(
  ctx: MutationCtx,
  campaign: Doc<"scheduledMessages">,
  recipients: Doc<"contacts">[]
) {
  const events = await ctx.db.query("events").collect();
  const eventName = campaign.eventKey
    ? (events.find((e) => e.key === campaign.eventKey)?.name ??
      campaign.eventKey)
    : "—";

  for (const contact of recipients) {
    let tableName = "—";
    if (campaign.eventKey) {
      const seats = await ctx.db
        .query("seats")
        .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
        .collect();
      const seat = seats.find((s) => s.eventKey === campaign.eventKey);
      if (seat) {
        const table = await ctx.db.get(seat.tableId);
        if (table) tableName = table.name;
      }
    }

    // Insert first so the guest link can carry the send id for open/reply tracking.
    const sendId = await ctx.db.insert("sends", {
      contactId: contact._id,
      body: "",
      eventKey: campaign.eventKey,
      channel: campaign.autoSend ? "kapso" : "wa_link",
      status: "pending",
      createdAt: Date.now(),
      scheduledMessageId: campaign._id,
    });

    const undecided = contact.attendance === undefined;
    let link = "";
    if (campaign.kind === "invite" && undecided) {
      link = `${SITE_URL}/rsvp/${contact.token}?s=${sendId}`;
    } else if (campaign.kind === "reminder") {
      link = `${SITE_URL}/details/${contact.token}?s=${sendId}`;
    } else if (campaign.kind === "guide") {
      link = `${SITE_URL}/guide?t=${contact.token}&s=${sendId}`;
    }

    let body = campaign.body
      .replaceAll("{name}", contact.name)
      .replaceAll("{table}", tableName)
      .replaceAll("{event}", eventName);

    if (body.includes("{link}")) {
      body = body.replaceAll("{link}", link).replace(/[ \t]+\n/g, "\n").trim();
    } else if (campaign.kind === "invite" && undecided) {
      body += `\n\nWhich wedding would you like to attend? Choose here: ${link}`;
    } else if (link) {
      body += `\n\n${link}`;
    }

    await ctx.db.patch(sendId, { body });
  }
}

export const scheduleMessage = mutation({
  args: {
    name: v.string(),
    kind,
    body: v.string(),
    groupId: v.optional(v.id("groups")),
    eventKey: v.optional(eventKey),
    sendAt: v.number(),
    autoSend: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.sendAt <= Date.now()) {
      throw new Error("Pick a time in the future");
    }
    const id = await ctx.db.insert("scheduledMessages", {
      ...args,
      status: "scheduled",
    });
    const jobId = await ctx.scheduler.runAt(args.sendAt, internal.scheduled.fire, {
      id,
    });
    await ctx.db.patch(id, { schedulerJobId: jobId });
    return id;
  },
});

export const cancelScheduled = mutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const msg = await ctx.db.get(id);
    if (!msg) return;
    if (msg.schedulerJobId) {
      await ctx.scheduler.cancel(
        msg.schedulerJobId as Id<"_scheduled_functions">
      );
    }
    await ctx.db.patch(id, { status: "canceled" });
  },
});

export const deleteScheduled = mutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const msg = await ctx.db.get(id);
    if (!msg) return;
    if (msg.status === "scheduled" && msg.schedulerJobId) {
      await ctx.scheduler.cancel(
        msg.schedulerJobId as Id<"_scheduled_functions">
      );
    }
    // Remove the queued send rows belonging to this campaign.
    const sends = await ctx.db
      .query("sends")
      .withIndex("by_scheduled", (q) => q.eq("scheduledMessageId", id))
      .collect();
    for (const send of sends) await ctx.db.delete(send._id);
    await ctx.db.delete(id);
  },
});

// Runs at the scheduled time.
export const fire = internalMutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const msg = await ctx.db.get(id);
    if (!msg || msg.status !== "scheduled") return;

    let recipients = await ctx.db.query("contacts").collect();
    if (msg.groupId) {
      recipients = recipients.filter((c) => c.groupIds.includes(msg.groupId!));
    }

    await queueSendsFor(ctx, msg, recipients);
    await ctx.db.patch(id, { status: "due" });

    // Auto-send campaigns hand the whole queue straight to Kapso.
    if (msg.autoSend) {
      await ctx.scheduler.runAfter(0, internal.kapso.sendCampaign, {
        scheduledMessageId: id,
      });
    }
  },
});

// "Nudge the silent ones": clone a fired campaign into an immediately-due
// queue targeting only recipients who haven't responded yet.
export const nudge = mutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const original = await ctx.db.get(id);
    if (!original || (original.status !== "due" && original.status !== "done")) {
      throw new Error("Only fired campaigns can be nudged");
    }

    const sends = await ctx.db
      .query("sends")
      .withIndex("by_scheduled", (q) => q.eq("scheduledMessageId", id))
      .collect();

    const recipients: Doc<"contacts">[] = [];
    for (const send of sends) {
      const contact = await ctx.db.get(send.contactId);
      if (!contact) continue;
      // "Responded" depends on the campaign's goal, not just the link click:
      // invites → still undecided; reminders → no details submitted yet;
      // guide/custom → never opened/replied via their link.
      const silent =
        original.kind === "invite"
          ? contact.attendance === undefined
          : original.kind === "reminder"
            ? contact.detailsSubmittedAt == null
            : send.repliedAt == null && send.openedAt == null;
      if (silent && !recipients.some((r) => r._id === contact._id)) {
        recipients.push(contact);
      }
    }

    if (recipients.length === 0) return { queued: 0 };

    const nudgeId = await ctx.db.insert("scheduledMessages", {
      name: `${original.name} — nudge`,
      kind: original.kind,
      body: original.body,
      groupId: original.groupId,
      eventKey: original.eventKey,
      sendAt: Date.now(),
      autoSend: original.autoSend,
      status: "due",
    });
    const campaign = await ctx.db.get(nudgeId);
    await queueSendsFor(ctx, campaign!, recipients);
    if (original.autoSend) {
      await ctx.scheduler.runAfter(0, internal.kapso.sendCampaign, {
        scheduledMessageId: nudgeId,
      });
    }
    return { queued: recipients.length };
  },
});

export const listScheduled = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("scheduledMessages").collect();
    const groups = await ctx.db.query("groups").collect();
    const result = await Promise.all(
      messages.map(async (msg) => {
        const sends = await ctx.db
          .query("sends")
          .withIndex("by_scheduled", (q) => q.eq("scheduledMessageId", msg._id))
          .collect();
        return {
          ...msg,
          groupName: msg.groupId
            ? (groups.find((g) => g._id === msg.groupId)?.name ?? "(deleted)")
            : "Everyone",
          recipients: sends.length,
          sentCount: sends.filter((s) => s.status === "sent").length,
          openedCount: sends.filter((s) => s.openedAt != null).length,
          repliedCount: sends.filter((s) => s.repliedAt != null).length,
        };
      })
    );
    return result.sort((a, b) => b.sendAt - a.sendAt);
  },
});

// Pending sends for a fired campaign, ready for the wa.me queue.
export const dueSends = query({
  args: { scheduledMessageId: v.id("scheduledMessages") },
  handler: async (ctx, { scheduledMessageId }) => {
    const sends = await ctx.db
      .query("sends")
      .withIndex("by_scheduled", (q) =>
        q.eq("scheduledMessageId", scheduledMessageId)
      )
      .collect();
    return await Promise.all(
      sends.map(async (send) => {
        const contact = await ctx.db.get(send.contactId);
        return {
          ...send,
          contactName: contact?.name ?? "(deleted)",
          phone: contact?.phone ?? "",
        };
      })
    );
  },
});
