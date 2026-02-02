import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByTask = query({
  args: { taskId: v.string() },
  handler: async (ctx, { taskId }) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("asc")
      .collect();
  },
});

export const getAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("comments").order("desc").collect();
  },
});

export const add = mutation({
  args: {
    taskId: v.string(),
    author: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { taskId, author, text }) => {
    return await ctx.db.insert("comments", {
      taskId,
      author,
      text,
      createdAt: Date.now(),
    });
  },
});
