import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { attendsEvent } from "./attendance";

export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    const contacts = await ctx.db.query("contacts").collect();
    return events.map((event) => ({
      ...event,
      attending: contacts.filter((c) => attendsEvent(c.attendance, event.key))
        .length,
    }));
  },
});

export const updateEvent = mutation({
  args: {
    key: v.union(v.literal("traditional"), v.literal("white")),
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, { key, date, venue, capacity }) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!event) throw new Error("Event not found");
    if (capacity != null && capacity < 1)
      throw new Error("Capacity must be at least 1");
    await ctx.db.patch(event._id, { date, venue, capacity });
  },
});
