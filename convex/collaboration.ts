import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Obtener eventos de colaboración de una tarea
export const getTaskCollaboration = query({
  args: { taskId: v.string() },
  handler: async (ctx, { taskId }) => {
    return await ctx.db.query("collaborationEvents")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("desc")
      .collect();
  },
});

// Obtener feed unificado: comentarios + eventos de colaboración
export const getUnifiedTaskFeed = query({
  args: { taskId: v.string() },
  handler: async (ctx, { taskId }) => {
    const [comments, events] = await Promise.all([
      ctx.db.query("comments")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect(),
      ctx.db.query("collaborationEvents")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect(),
    ]);

    // Normalizar a formato común
    const normalizedComments = comments.map(c => ({
      _id: c._id,
      type: "comment" as const,
      author: c.author,
      text: c.text,
      createdAt: c.createdAt || c.timestamp || Date.now(),
      original: c,
    }));

    const normalizedEvents = events.map(e => ({
      _id: e._id,
      type: e.type,
      author: e.agentId,
      text: e.message || "",
      createdAt: e.createdAt,
      metadata: e.metadata,
      targetAgentId: e.targetAgentId,
      responded: e.responded,
      original: e,
    }));

    // Merge y ordenar por fecha (más reciente primero)
    const unified = [...normalizedComments, ...normalizedEvents]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return unified;
  },
});

// Obtener pings pendientes para un agente
export const getPendingPings = query({
  args: { agentId: v.string() },
  handler: async (ctx, { agentId }) => {
    return await ctx.db.query("collaborationEvents")
      .withIndex("by_target_agent", (q) => 
        q.eq("targetAgentId", agentId).eq("responded", false)
      )
      .order("desc")
      .collect();
  },
});

// Crear evento de colaboración genérico
export const createEvent = mutation({
  args: {
    taskId: v.string(),
    type: v.union(
      v.literal("thought_log"),
      v.literal("design_decision"),
      v.literal("blocker"),
      v.literal("status_change")
    ),
    agentId: v.string(),
    message: v.string(),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { taskId, type, agentId, message, severity, metadata }) => {
    const eventId = await ctx.db.insert("collaborationEvents", {
      taskId,
      type,
      agentId,
      message,
      severity,
      metadata,
      createdAt: Date.now(),
    });

    return { success: true, eventId };
  },
});

// Ping a otro agente (para @mentions)
export const pingAgent = mutation({
  args: {
    taskId: v.string(),
    fromAgentId: v.string(),
    targetAgentId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { taskId, fromAgentId, targetAgentId, message }) => {
    // Anti-loop: verificar que no haya ping no respondido reciente del target a este agente
    const recentPings = await ctx.db.query("collaborationEvents")
      .withIndex("by_target_agent", (q) => 
        q.eq("targetAgentId", fromAgentId).eq("responded", false)
      )
      .filter((q) => q.eq(q.field("agentId"), targetAgentId))
      .collect();

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const hasRecentUnresponded = recentPings.some(p => (p.createdAt || 0) > fiveMinutesAgo);

    if (hasRecentUnresponded) {
      throw new Error("Anti-loop: Target agent has unresponded ping to you in the last 5 minutes");
    }

    // Rate limiting: max 3 pings por agente destino en esta tarea
    const existingPings = await ctx.db.query("collaborationEvents")
      .withIndex("by_target_agent", (q) => 
        q.eq("targetAgentId", targetAgentId)
      )
      .filter((q) => q.eq(q.field("taskId"), taskId))
      .collect();

    if (existingPings.length >= 3) {
      throw new Error(`Rate limit: Max 3 pings to ${targetAgentId} per task`);
    }

    // Crear el ping
    const eventId = await ctx.db.insert("collaborationEvents", {
      taskId,
      type: "ping",
      agentId: fromAgentId,
      targetAgentId,
      message,
      responded: false,
      createdAt: Date.now(),
    });

    return { success: true, eventId };
  },
});

// Responder a un ping (marcar como respondido)
export const respondToPing = mutation({
  args: {
    eventId: v.id("collaborationEvents"),
    responseMessage: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, responseMessage }) => {
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Ping not found");
    }

    if (event.type !== "ping") {
      throw new Error("Event is not a ping");
    }

    if (event.responded) {
      throw new Error("Ping already responded");
    }

    // Actualizar como respondido
    await ctx.db.patch(eventId, {
      responded: true,
      respondedAt: Date.now(),
    });

    // Opcionalmente agregar respuesta como comment
    if (responseMessage) {
      await ctx.db.insert("comments", {
        taskId: event.taskId,
        author: event.targetAgentId || "unknown",
        text: responseMessage,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Log de thought (pensamiento del agente)
export const logThought = mutation({
  args: {
    taskId: v.string(),
    agentId: v.string(),
    thought: v.string(),
  },
  handler: async (ctx, { taskId, agentId, thought }) => {
    const eventId = await ctx.db.insert("collaborationEvents", {
      taskId,
      type: "thought_log",
      agentId,
      message: thought,
      createdAt: Date.now(),
    });

    return { success: true, eventId };
  },
});

// Registrar decisión de diseño
export const recordDesignDecision = mutation({
  args: {
    taskId: v.string(),
    agentId: v.string(),
    decision: v.string(),
    rationale: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, agentId, decision, rationale }) => {
    const eventId = await ctx.db.insert("collaborationEvents", {
      taskId,
      type: "design_decision",
      agentId,
      message: decision,
      metadata: { rationale },
      createdAt: Date.now(),
    });

    return { success: true, eventId };
  },
});

// Reportar blocker
export const reportBlocker = mutation({
  args: {
    taskId: v.string(),
    agentId: v.string(),
    description: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, { taskId, agentId, description, severity }) => {
    const eventId = await ctx.db.insert("collaborationEvents", {
      taskId,
      type: "blocker",
      agentId,
      message: description,
      severity,
      createdAt: Date.now(),
    });

    return { success: true, eventId };
  },
});

// Parser de @mentions en texto
export function parseMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  
  return [...new Set(mentions)]; // Eliminar duplicados
}

// Crear comment con parsing de @mentions
export const createCommentWithMentions = mutation({
  args: {
    taskId: v.string(),
    author: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { taskId, author, text }) => {
    // Crear el comentario
    const commentId = await ctx.db.insert("comments", {
      taskId,
      author,
      text,
      createdAt: Date.now(),
    });

    // Parsear y crear pings por cada @mention
    const mentions = parseMentions(text);
    const pingIds: string[] = [];

    for (const mention of mentions) {
      try {
        const eventId = await ctx.db.insert("collaborationEvents", {
          taskId,
          type: "mention",
          agentId: author,
          targetAgentId: mention,
          message: text,
          responded: false,
          createdAt: Date.now(),
        });
        pingIds.push(eventId.toString());
      } catch (e) {
        // Si falla un ping individual, continuar con los demás
        console.error(`Failed to create ping for @${mention}:`, e);
      }
    }

    return { success: true, commentId, mentions, pingIds };
  },
});

// Query para obtener mentions pendientes (versión específica)
export const getPendingMentions = query({
  args: { agentName: v.string() },
  handler: async (ctx, { agentName }) => {
    const mentions = await ctx.db.query("collaborationEvents")
      .withIndex("by_target_agent", (q) => 
        q.eq("targetAgentId", agentName.toLowerCase()).eq("responded", false)
      )
      .collect();

    return mentions.filter(m => m.type === "mention" || m.type === "ping");
  },
});

// Marcar mention como respondida
export const resolveMention = mutation({
  args: {
    eventId: v.id("collaborationEvents"),
  },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Mention not found");
    }

    if (event.type !== "mention" && event.type !== "ping") {
      throw new Error("Event is not a mention or ping");
    }

    await ctx.db.patch(eventId, {
      responded: true,
      respondedAt: Date.now(),
    });

    return { success: true };
  },
});
