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
    // Campos para aprobaciones
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
    // Campos para definición de equipo (LGTM tracking)
    definitionApprovals: v.optional(v.array(v.string())),
    // Tracking para notificaciones
    notificationSentAt: v.optional(v.number()),
    notificationType: v.optional(v.string()),
  }),

  // Sistema de notificaciones proactivas
  notifications: defineTable({
    taskId: v.string(),
    type: v.union(v.literal("done"), v.literal("blocked")),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    taskTitle: v.string(),
    taskStatus: v.string(),
    assigneeIds: v.array(v.string()),
    detectedAt: v.number(),
    sentAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  }).index("by_status", ["status"])
    .index("by_task", ["taskId"])
    .index("by_detected_at", ["detectedAt"]),

  // Eventos de colaboración para audit log y mentions
  collaborationEvents: defineTable({
    taskId: v.string(),
    type: v.union(
      v.literal("ping"),
      v.literal("thought_log"),
      v.literal("design_decision"),
      v.literal("status_change"),
      v.literal("blocker"),
      v.literal("permission_denied"),
      v.literal("mention")
    ),
    // Campos legacy para compatibilidad con datos existentes
    author: v.optional(v.string()),
    content: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    // Campos nuevos
    agentId: v.optional(v.string()),
    message: v.optional(v.string()),
    targetAgentId: v.optional(v.string()),
    responded: v.optional(v.boolean()),
    respondedAt: v.optional(v.number()),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    metadata: v.optional(v.any()),
    createdAt: v.optional(v.number()),
  }).index("by_task", ["taskId"])
    .index("by_target_agent", ["targetAgentId", "responded"]),
});
