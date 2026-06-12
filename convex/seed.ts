import { mutation } from "./_generated/server";

// Idempotent: called from the app shell on every load, but only writes once.
export const init = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("events").collect();
    if (existing.length > 0) {
      // Migration: older contacts may predate guest-link tokens.
      const contacts = await ctx.db.query("contacts").collect();
      for (const contact of contacts) {
        if (!contact.token) {
          await ctx.db.patch(contact._id, {
            token: crypto.randomUUID().replace(/-/g, ""),
          });
        }
      }
      return;
    }

    await ctx.db.insert("events", {
      key: "traditional",
      name: "Traditional Wedding",
    });
    await ctx.db.insert("events", { key: "white", name: "White Wedding" });

    const familyId = await ctx.db.insert("groups", { name: "Family" });
    await ctx.db.insert("groups", { name: "Friends" });

    const traditionalTable = await ctx.db.insert("tables", {
      eventKey: "traditional",
      name: "Table 1",
      capacity: 8,
    });
    const whiteTable = await ctx.db.insert("tables", {
      eventKey: "white",
      name: "Table 1",
      capacity: 8,
    });

    const contactId = await ctx.db.insert("contacts", {
      name: "You (edit me)",
      phone: "+250000000000",
      groupIds: [familyId],
      token: crypto.randomUUID().replace(/-/g, ""),
    });
    await ctx.db.insert("seats", {
      contactId,
      eventKey: "traditional",
      tableId: traditionalTable,
    });
    await ctx.db.insert("seats", {
      contactId,
      eventKey: "white",
      tableId: whiteTable,
    });
  },
});
