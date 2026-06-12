import { QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export type Attendance = "traditional" | "white" | "both";
export type EventKeyT = "traditional" | "white";

export function attendsEvent(
  attendance: Attendance | undefined,
  key: EventKeyT
) {
  return attendance === "both" || attendance === key;
}

// Throws if setting `next` on `contactId` would overflow a configured event capacity.
export async function assertCapacity(
  ctx: QueryCtx,
  contactId: Id<"contacts"> | null,
  next: Attendance
) {
  const keys: EventKeyT[] =
    next === "both" ? ["traditional", "white"] : [next];
  const contacts = await ctx.db.query("contacts").collect();
  for (const key of keys) {
    const event = await ctx.db
      .query("events")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (event?.capacity == null) continue;
    const attending = contacts.filter(
      (c) => c._id !== contactId && attendsEvent(c.attendance, key)
    ).length;
    if (attending >= event.capacity) {
      throw new Error(`capacity:${event.name} is full (${event.capacity} guests)`);
    }
  }
}
