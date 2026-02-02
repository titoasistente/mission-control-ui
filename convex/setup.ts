import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const addAgent = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    status: v.string(),
    sessionKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", args);
  },
});

export const addTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    status: v.string(),
    assigneeIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", args);
  },
});
