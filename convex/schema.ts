import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  comments: defineTable({
    taskId: v.string(),
    author: v.string(),
    text: v.string(),
    createdAt: v.optional(v.number()),
    timestamp: v.optional(v.number()),
  }).index("by_task", ["taskId"]),

  agents: defineTable({
    name: v.string(),
    role: v.string(),
    status: v.string(),
    sessionKey: v.string(),
    currentTaskId: v.optional(v.string()),
  }),
  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.string(),
    assigneeIds: v.array(v.string()),
    project: v.optional(v.string()),
    projectId: v.optional(v.string()),
    order: v.optional(v.number()),
    position: v.optional(v.number()),
    lastUpdated: v.optional(v.number()),
    lastUpdate: v.optional(v.number()),
  }),
});
