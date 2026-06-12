import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const eventKey = v.union(v.literal("traditional"), v.literal("white"));
const attendance = v.union(
  v.literal("traditional"),
  v.literal("white"),
  v.literal("both")
);

export default defineSchema({
  groups: defineTable({
    name: v.string(),
    color: v.optional(v.string()),
  }),

  contacts: defineTable({
    name: v.string(),
    phone: v.string(), // international format, e.g. +250788123456
    groupIds: v.array(v.id("groups")),
    notes: v.optional(v.string()),
    // Which wedding(s) this guest attends. Absent = undecided (gets RSVP buttons).
    attendance: v.optional(attendance),
    rsvpRepliedAt: v.optional(v.number()),
    // Personal token for guest-facing links (/rsvp, /details).
    token: v.optional(v.string()),
    // Submitted by the guest via the details form.
    allergies: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
    detailsSubmittedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  // Two fixed events: "traditional" and "white". Seeded on first load.
  events: defineTable({
    key: eventKey,
    name: v.string(), // "Traditional Wedding", "White Wedding"
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
    capacity: v.optional(v.number()),
  }).index("by_key", ["key"]),

  tables: defineTable({
    eventKey,
    name: v.string(), // "Table 1", "Family table", etc.
    capacity: v.number(),
  }).index("by_event", ["eventKey"]),

  // A contact can have one seat per event (so two assignments max).
  seats: defineTable({
    contactId: v.id("contacts"),
    tableId: v.id("tables"),
    eventKey,
  })
    .index("by_event", ["eventKey"])
    .index("by_contact", ["contactId"])
    .index("by_table", ["tableId"]),

  templates: defineTable({
    name: v.string(),
    body: v.string(), // supports {name} {table} {event}
  }),

  // A message scheduled for a future day & time, targeted at a group (or everyone).
  scheduledMessages: defineTable({
    name: v.string(),
    kind: v.union(
      v.literal("invite"), // undecided guests get the wedding-choice link appended
      v.literal("reminder"), // {link} resolves to the guest details form
      v.literal("guide"), // {link} resolves to the stay & activities guide
      v.literal("custom")
    ),
    body: v.string(), // supports {name} {table} {event} {link}
    groupId: v.optional(v.id("groups")), // undefined = everyone
    eventKey: v.optional(eventKey), // context for {table} / {event}
    sendAt: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("due"), // fired: per-recipient messages are queued on the Messages page
      v.literal("done"), // every queued message marked sent
      v.literal("canceled")
    ),
    schedulerJobId: v.optional(v.string()),
  }),

  // Log of message sends, so the operator can track progress.
  sends: defineTable({
    contactId: v.id("contacts"),
    body: v.string(), // resolved message text
    eventKey: v.optional(eventKey),
    channel: v.union(v.literal("wa_link"), v.literal("kapso")),
    status: v.union(v.literal("pending"), v.literal("sent")),
    createdAt: v.number(),
    scheduledMessageId: v.optional(v.id("scheduledMessages")),
    openedAt: v.optional(v.number()), // guest opened their personal link
    repliedAt: v.optional(v.number()), // guest chose a wedding / submitted the form
  })
    .index("by_contact", ["contactId"])
    .index("by_scheduled", ["scheduledMessageId"]),

  // Stay & activity suggestions shown on the public /guide page.
  guideItems: defineTable({
    kind: v.union(v.literal("stay"), v.literal("activity")),
    title: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
  }),
});
