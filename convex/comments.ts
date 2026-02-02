import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Parser de @mentions en texto
function parseMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  
  return [...new Set(mentions)]; // Eliminar duplicados
}

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
        // Rate limiting: max 3 pings por agente destino en esta tarea
        const existingPings = await ctx.db.query("collaborationEvents")
          .withIndex("by_target_agent", (q) => 
            q.eq("targetAgentId", mention)
          )
          .filter((q) => q.eq(q.field("taskId"), taskId))
          .collect();

        if (existingPings.length >= 3) {
          continue; // Skip si ya hay 3 pings
        }

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
