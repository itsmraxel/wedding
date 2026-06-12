import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertCapacity } from "./attendance";

const PHONE_RE = /^\+[1-9]\d{6,14}$/;
const attendance = v.union(
  v.literal("traditional"),
  v.literal("white"),
  v.literal("both")
);

function newToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function normalizePhone(raw: string) {
  return raw.replace(/[\s-()]/g, "");
}

export const listContacts = query({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db.query("contacts").collect();
    const groups = await ctx.db.query("groups").collect();
    const groupById = new Map(groups.map((g) => [g._id, g]));

    return await Promise.all(
      contacts.map(async (contact) => {
        const seats = await ctx.db
          .query("seats")
          .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
          .collect();
        const seatInfo: {
          traditional: { seatId: string; tableId: string; tableName: string } | null;
          white: { seatId: string; tableId: string; tableName: string } | null;
        } = { traditional: null, white: null };
        for (const seat of seats) {
          const table = await ctx.db.get(seat.tableId);
          if (table) {
            seatInfo[seat.eventKey] = {
              seatId: seat._id,
              tableId: seat.tableId,
              tableName: table.name,
            };
          }
        }
        return {
          ...contact,
          groups: contact.groupIds.flatMap((id) => {
            const g = groupById.get(id);
            return g ? [{ _id: g._id, name: g.name, color: g.color }] : [];
          }),
          traditionalSeat: seatInfo.traditional,
          whiteSeat: seatInfo.white,
        };
      })
    );
  },
});

export const addContact = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    groupIds: v.array(v.id("groups")),
    notes: v.optional(v.string()),
    attendance: v.optional(attendance),
  },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    if (!PHONE_RE.test(phone)) {
      throw new Error(
        "Phone must be in international format, e.g. +250788123456"
      );
    }
    if (args.attendance) await assertCapacity(ctx, null, args.attendance);
    return await ctx.db.insert("contacts", {
      ...args,
      phone,
      token: newToken(),
    });
  },
});

// Paste-from-spreadsheet import. Each entry: name + phone + optional group
// names (created on the fly). Skips invalid phones and duplicates, returns a
// summary so the operator knows exactly what happened.
export const bulkAddContacts = mutation({
  args: {
    entries: v.array(
      v.object({
        name: v.string(),
        phone: v.string(),
        groupNames: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, { entries }) => {
    const existing = await ctx.db.query("contacts").collect();
    const seenPhones = new Set(existing.map((c) => c.phone));
    const groups = await ctx.db.query("groups").collect();
    const groupIdByName = new Map(
      groups.map((g) => [g.name.toLowerCase(), g._id])
    );

    let added = 0;
    const skipped: { name: string; reason: string }[] = [];

    for (const entry of entries) {
      const name = entry.name.trim();
      const phone = normalizePhone(entry.phone);
      if (!name) {
        skipped.push({ name: entry.phone, reason: "missing name" });
        continue;
      }
      if (!PHONE_RE.test(phone)) {
        skipped.push({ name, reason: `invalid phone "${entry.phone.trim()}"` });
        continue;
      }
      if (seenPhones.has(phone)) {
        skipped.push({ name, reason: "phone already in the guest list" });
        continue;
      }

      const groupIds = [];
      for (const rawName of entry.groupNames) {
        const groupName = rawName.trim();
        if (!groupName) continue;
        let id = groupIdByName.get(groupName.toLowerCase());
        if (!id) {
          id = await ctx.db.insert("groups", { name: groupName });
          groupIdByName.set(groupName.toLowerCase(), id);
        }
        groupIds.push(id);
      }

      await ctx.db.insert("contacts", {
        name,
        phone,
        groupIds,
        token: newToken(),
      });
      seenPhones.add(phone);
      added++;
    }

    return { added, skipped };
  },
});

// Lightweight inline update from the guests table.
export const setAttendance = mutation({
  args: {
    contactId: v.id("contacts"),
    attendance: v.optional(attendance),
  },
  handler: async (ctx, { contactId, attendance }) => {
    const contact = await ctx.db.get(contactId);
    if (!contact) throw new Error("Contact not found");
    if (attendance && attendance !== contact.attendance) {
      await assertCapacity(ctx, contactId, attendance);
    }
    await ctx.db.patch(contactId, { attendance });

    // Drop seats that contradict the new attendance.
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
    for (const seat of seats) {
      const attends =
        attendance === undefined ||
        attendance === "both" ||
        attendance === seat.eventKey;
      if (!attends) await ctx.db.delete(seat._id);
    }
  },
});

export const updateContact = mutation({
  args: {
    contactId: v.id("contacts"),
    name: v.string(),
    phone: v.string(),
    groupIds: v.array(v.id("groups")),
    notes: v.optional(v.string()),
    attendance: v.optional(attendance),
  },
  handler: async (ctx, { contactId, ...fields }) => {
    const phone = normalizePhone(fields.phone);
    if (!PHONE_RE.test(phone)) {
      throw new Error(
        "Phone must be in international format, e.g. +250788123456"
      );
    }
    const existing = await ctx.db.get(contactId);
    if (!existing) throw new Error("Contact not found");
    if (fields.attendance && fields.attendance !== existing.attendance) {
      await assertCapacity(ctx, contactId, fields.attendance);
    }
    await ctx.db.patch(contactId, {
      ...fields,
      phone,
      // Clearing attendance puts the guest back to "undecided".
      attendance: fields.attendance,
    });
  },
});

export const deleteContact = mutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .collect();
    for (const seat of seats) await ctx.db.delete(seat._id);
    await ctx.db.delete(contactId);
  },
});
