import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { attendsEvent } from "./attendance";

const eventKey = v.union(v.literal("traditional"), v.literal("white"));

export const listTables = query({
  args: { eventKey },
  handler: async (ctx, args) => {
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_event", (q) => q.eq("eventKey", args.eventKey))
      .collect();
    return await Promise.all(
      tables.map(async (table) => {
        const seats = await ctx.db
          .query("seats")
          .withIndex("by_table", (q) => q.eq("tableId", table._id))
          .collect();
        const guests = await Promise.all(
          seats.map(async (seat) => {
            const contact = await ctx.db.get(seat.contactId);
            return contact
              ? { seatId: seat._id, contactId: contact._id, name: contact.name }
              : null;
          })
        );
        return {
          ...table,
          guests: guests.filter((g) => g !== null),
        };
      })
    );
  },
});

export const listSeats = query({
  args: { eventKey },
  handler: async (ctx, args) => {
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_event", (q) => q.eq("eventKey", args.eventKey))
      .collect();
    return await Promise.all(
      seats.map(async (seat) => {
        const contact = await ctx.db.get(seat.contactId);
        const table = await ctx.db.get(seat.tableId);
        return {
          ...seat,
          contactName: contact?.name ?? "(deleted)",
          tableName: table?.name ?? "(deleted)",
        };
      })
    );
  },
});

export const addTable = mutation({
  args: { eventKey, name: v.string(), capacity: v.number() },
  handler: async (ctx, args) => {
    if (args.capacity < 1) throw new Error("Capacity must be at least 1");
    return await ctx.db.insert("tables", args);
  },
});

export const updateTable = mutation({
  args: { tableId: v.id("tables"), name: v.string(), capacity: v.number() },
  handler: async (ctx, { tableId, name, capacity }) => {
    const table = await ctx.db.get(tableId);
    if (!table) throw new Error("Table not found");
    if (capacity < 1) throw new Error("Capacity must be at least 1");
    const occupants = await ctx.db
      .query("seats")
      .withIndex("by_table", (q) => q.eq("tableId", tableId))
      .collect();
    if (capacity < occupants.length) {
      throw new Error(
        `${occupants.length} guests are already seated here — unseat some first or pick a larger capacity`
      );
    }
    await ctx.db.patch(tableId, { name: name.trim(), capacity });
  },
});

export const deleteTable = mutation({
  args: { tableId: v.id("tables") },
  handler: async (ctx, { tableId }) => {
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_table", (q) => q.eq("tableId", tableId))
      .collect();
    for (const seat of seats) await ctx.db.delete(seat._id);
    await ctx.db.delete(tableId);
  },
});

export const assignSeat = mutation({
  args: { contactId: v.id("contacts"), eventKey, tableId: v.id("tables") },
  handler: async (ctx, { contactId, eventKey, tableId }) => {
    const table = await ctx.db.get(tableId);
    if (!table) throw new Error("Table not found");
    if (table.eventKey !== eventKey)
      throw new Error("Table belongs to the other event");

    // Undecided guests may be seated in advance, but never contradict a
    // decided attendance (e.g. white-only guest at a traditional table).
    const contact = await ctx.db.get(contactId);
    if (!contact) throw new Error("Contact not found");
    if (contact.attendance && !attendsEvent(contact.attendance, eventKey)) {
      throw new Error(
        `attendance:${contact.name} isn't attending this event — change their attendance first`
      );
    }

    const occupants = await ctx.db
      .query("seats")
      .withIndex("by_table", (q) => q.eq("tableId", tableId))
      .collect();
    if (occupants.some((s) => s.contactId === contactId)) return;
    if (occupants.length >= table.capacity) {
      throw new Error(`${table.name} is full (${table.capacity} seats)`);
    }

    // One seat per contact per event: replace any existing assignment.
    const existing = await ctx.db
      .query("seats")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
    for (const seat of existing) {
      if (seat.eventKey === eventKey) await ctx.db.delete(seat._id);
    }

    await ctx.db.insert("seats", { contactId, eventKey, tableId });
  },
});

export const unassignSeat = mutation({
  args: { seatId: v.id("seats") },
  handler: async (ctx, { seatId }) => {
    await ctx.db.delete(seatId);
  },
});
