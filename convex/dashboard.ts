import { query } from "./_generated/server";
import { attendsEvent } from "./attendance";

export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db.query("contacts").collect();
    const groups = await ctx.db.query("groups").collect();
    const events = await ctx.db.query("events").collect();

    const perEvent = await Promise.all(
      (["traditional", "white"] as const).map(async (key) => {
        const tables = await ctx.db
          .query("tables")
          .withIndex("by_event", (q) => q.eq("eventKey", key))
          .collect();
        const seats = await ctx.db
          .query("seats")
          .withIndex("by_event", (q) => q.eq("eventKey", key))
          .collect();
        const event = events.find((e) => e.key === key);
        const seatedIds = new Set(seats.map((s) => s.contactId));
        const attendingContacts = contacts.filter((c) =>
          attendsEvent(c.attendance, key)
        );
        return {
          key,
          name: event?.name ?? key,
          date: event?.date ?? null,
          venue: event?.venue ?? null,
          tablesCount: tables.length,
          tableCapacity: tables.reduce((sum, t) => sum + t.capacity, 0),
          seated: seats.length,
          // Attending this event but not yet given a table.
          unseated: attendingContacts.filter((c) => !seatedIds.has(c._id))
            .length,
          eventCapacity: event?.capacity ?? null,
          attending: attendingContacts.length,
        };
      })
    );

    // Guests seated in both events.
    const allSeats = await ctx.db.query("seats").collect();
    const byContact = new Map<string, Set<string>>();
    for (const seat of allSeats) {
      const set = byContact.get(seat.contactId) ?? new Set();
      set.add(seat.eventKey);
      byContact.set(seat.contactId, set);
    }
    const seatedBoth = [...byContact.values()].filter(
      (events) => events.size === 2
    ).length;

    return {
      totalGuests: contacts.length,
      totalGroups: groups.length,
      perEvent,
      attendingBoth: seatedBoth,
      attendance: {
        traditional: contacts.filter((c) => c.attendance === "traditional")
          .length,
        white: contacts.filter((c) => c.attendance === "white").length,
        both: contacts.filter((c) => c.attendance === "both").length,
        undecided: contacts.filter((c) => c.attendance === undefined).length,
      },
      rsvp: {
        replied: contacts.filter((c) => c.rsvpRepliedAt != null).length,
        detailsSubmitted: contacts.filter((c) => c.detailsSubmittedAt != null)
          .length,
      },
    };
  },
});
