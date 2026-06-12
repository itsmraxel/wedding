import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listGuideItems = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("guideItems").collect();
  },
});

export const addGuideItem = mutation({
  args: {
    kind: v.union(v.literal("stay"), v.literal("activity")),
    title: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("guideItems", args);
  },
});

export const deleteGuideItem = mutation({
  args: { itemId: v.id("guideItems") },
  handler: async (ctx, { itemId }) => {
    await ctx.db.delete(itemId);
  },
});
