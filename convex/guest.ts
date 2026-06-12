import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCapacity, attendsEvent } from "./attendance";

// Public, token-scoped functions backing the guest-facing pages.

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!contact) return null;

    const events = await ctx.db.query("events").collect();
    const contacts = await ctx.db.query("contacts").collect();
    return {
      name: contact.name,
      attendance: contact.attendance ?? null,
      allergies: contact.allergies ?? "",
      specialRequests: contact.specialRequests ?? "",
      detailsSubmittedAt: contact.detailsSubmittedAt ?? null,
      events: (["traditional", "white"] as const).map((key) => {
        const event = events.find((e) => e.key === key);
        const attending = contacts.filter((c) =>
          attendsEvent(c.attendance, key)
        ).length;
        return {
          key,
          name: event?.name ?? key,
          date: event?.date ?? null,
          venue: event?.venue ?? null,
          full: event?.capacity != null && attending >= event.capacity,
        };
      }),
    };
  },
});

export const chooseWedding = mutation({
  args: {
    token: v.string(),
    choice: v.union(v.literal("traditional"), v.literal("white")),
    sendId: v.optional(v.id("sends")),
  },
  handler: async (ctx, { token, choice, sendId }) => {
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!contact) throw new Error("Invalid link");

    await assertCapacity(ctx, contact._id, choice);
    await ctx.db.patch(contact._id, {
      attendance: choice,
      rsvpRepliedAt: Date.now(),
    });
    // Drop seats that contradict the new choice (e.g. switching weddings).
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
      .collect();
    for (const seat of seats) {
      if (!attendsEvent(choice, seat.eventKey)) await ctx.db.delete(seat._id);
    }
    if (sendId) {
      const send = await ctx.db.get(sendId);
      if (send && send.contactId === contact._id && send.repliedAt == null) {
        await ctx.db.patch(sendId, { repliedAt: Date.now() });
      }
    }
  },
});

export const submitDetails = mutation({
  args: {
    token: v.string(),
    allergies: v.string(),
    specialRequests: v.string(),
    sendId: v.optional(v.id("sends")),
  },
  handler: async (ctx, { token, allergies, specialRequests, sendId }) => {
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!contact) throw new Error("Invalid link");

    await ctx.db.patch(contact._id, {
      allergies: allergies.trim() || undefined,
      specialRequests: specialRequests.trim() || undefined,
      detailsSubmittedAt: Date.now(),
    });
    if (sendId) {
      const send = await ctx.db.get(sendId);
      if (send && send.contactId === contact._id && send.repliedAt == null) {
        await ctx.db.patch(sendId, { repliedAt: Date.now() });
      }
    }
  },
});

// Called when a guest opens their personal link, for "received" tracking.
export const markOpened = mutation({
  args: { token: v.string(), sendId: v.id("sends") },
  handler: async (ctx, { token, sendId }) => {
    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!contact) return;
    const send = await ctx.db.get(sendId);
    if (send && send.contactId === contact._id && send.openedAt == null) {
      await ctx.db.patch(sendId, { openedAt: Date.now() });
    }
  },
});

export const listGuide = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("guideItems").collect();
  },
});
