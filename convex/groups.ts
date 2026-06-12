import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listGroups = query({
  args: {},
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    const contacts = await ctx.db.query("contacts").collect();
    return groups.map((group) => ({
      ...group,
      memberCount: contacts.filter((c) => c.groupIds.includes(group._id))
        .length,
      members: contacts
        .filter((c) => c.groupIds.includes(group._id))
        .map((c) => ({ _id: c._id, name: c.name })),
    }));
  },
});

export const addGroup = mutation({
  args: { name: v.string(), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db.insert("groups", args);
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { groupId, name, color }) => {
    await ctx.db.patch(groupId, { name, color });
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    // Remove the group from every contact that references it.
    const contacts = await ctx.db.query("contacts").collect();
    for (const contact of contacts) {
      if (contact.groupIds.includes(groupId)) {
        await ctx.db.patch(contact._id, {
          groupIds: contact.groupIds.filter((id) => id !== groupId),
        });
      }
    }
    await ctx.db.delete(groupId);
  },
});
