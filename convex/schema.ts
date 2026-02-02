import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    status: v.string(),
    sessionKey: v.string(),
  }),
  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.string(),
    assigneeIds: v.array(v.string()),
  }),
});
