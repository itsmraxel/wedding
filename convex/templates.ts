import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templates").collect();
  },
});

export const saveTemplate = mutation({
  args: {
    templateId: v.optional(v.id("templates")),
    name: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { templateId, name, body }) => {
    if (templateId) {
      await ctx.db.patch(templateId, { name, body });
      return templateId;
    }
    return await ctx.db.insert("templates", { name, body });
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    await ctx.db.delete(templateId);
  },
});
