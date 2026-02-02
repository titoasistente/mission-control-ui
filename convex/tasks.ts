import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const reorder = mutation({
  args: {
    taskId: v.id("tasks"),
    newOrder: v.number(),
  },
  handler: async (ctx, { taskId, newOrder }) => {
    await ctx.db.patch(taskId, { 
      order: newOrder,
      lastUpdated: Date.now()
    });
  },
});

export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.string(),
  },
  handler: async (ctx, { taskId, status }) => {
    await ctx.db.patch(taskId, { 
      status,
      lastUpdated: Date.now()
    });
  },
});
