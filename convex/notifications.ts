import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const NOTIFICATION_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos

// Query: Obtener notificaciones pendientes
export const getPending = query({
  handler: async (ctx) => {
    return await ctx.db.query("notifications")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .order("desc")
      .collect();
  },
});

// Query: Obtener historial de notificaciones enviadas
export const getSent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    return await ctx.db.query("notifications")
      .filter((q) => q.eq(q.field("status"), "sent"))
      .order("desc")
      .take(limit);
  },
});

// Mutation: Detectar tareas bloqueadas o finalizadas que necesitan notificación
export const detectStuckTasks = mutation({
  handler: async (ctx) => {
    const now = Date.now();
    const results = {
      detected: 0,
      alreadyNotified: 0,
      errors: [] as string[],
    };

    // Buscar tareas en estado "done" o "blocked"
    const allTasks = await ctx.db.query("tasks").collect();
    
    for (const task of allTasks) {
      // Solo procesar done o blocked
      if (task.status !== "done" && task.status !== "blocked") {
        continue;
      }

      // Verificar si ya tiene notificación reciente (evitar spam)
      if (task.notificationSentAt) {
        const timeSinceNotification = now - task.notificationSentAt;
        if (timeSinceNotification < NOTIFICATION_THRESHOLD_MS * 2) {
          results.alreadyNotified++;
          continue;
        }
      }

      // Verificar tiempo en el estado actual
      const lastUpdate = task.lastUpdated || task.lastUpdate || task._creationTime;
      const timeInStatus = now - lastUpdate;

      // Si lleva más de 10 minutos en este estado
      if (timeInStatus >= NOTIFICATION_THRESHOLD_MS) {
        try {
          // Verificar si ya existe notificación pendiente para esta tarea
          const existingNotifications = await ctx.db.query("notifications")
            .filter((q) => q.eq(q.field("taskId"), task._id.toString()))
            .filter((q) => q.eq(q.field("status"), "pending"))
            .collect();

          if (existingNotifications.length > 0) {
            continue; // Ya hay notificación pendiente
          }

          // Crear registro de notificación
          await ctx.db.insert("notifications", {
            taskId: task._id.toString(),
            type: task.status as "done" | "blocked",
            status: "pending",
            taskTitle: task.title,
            taskStatus: task.status,
            assigneeIds: task.assigneeIds || [],
            detectedAt: now,
            retryCount: 0,
          });

          // Marcar tarea como notificada
          await ctx.db.patch(task._id, {
            notificationSentAt: now,
            notificationType: task.status,
          });

          results.detected++;
        } catch (error) {
          results.errors.push(`Error processing task ${task._id}: ${error}`);
        }
      }
    }

    return results;
  },
});

// Mutation: Procesar notificaciones pendientes (simular envío WhatsApp)
export const processPending = mutation({
  handler: async (ctx) => {
    const pendingNotifications = await ctx.db.query("notifications")
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(10); // Procesar en batches

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const notification of pendingNotifications) {
      try {
        // Simular envío WhatsApp (en producción, esto llamaría a webhook de OpenClaw)
        const message = formatWhatsAppMessage(notification);
        
        // Log del intento de notificación
        await ctx.db.insert("collaborationEvents", {
          taskId: notification.taskId,
          type: "blocker",
          agentId: "loki",
          message: `📱 WhatsApp Alert: ${message}`,
          severity: notification.type === "blocked" ? "high" : "medium",
          metadata: {
            notificationId: notification._id,
            notificationType: notification.type,
            taskTitle: notification.taskTitle,
          },
          createdAt: Date.now(),
        });

        // Marcar como enviada
        await ctx.db.patch(notification._id, {
          status: "sent",
          sentAt: Date.now(),
        });

        results.processed++;
      } catch (error) {
        await ctx.db.patch(notification._id, {
          status: "failed",
          errorMessage: String(error),
          retryCount: (notification.retryCount || 0) + 1,
        });
        results.failed++;
        results.errors.push(String(error));
      }
    }

    return results;
  },
});

// Action: Enviar notificación real vía HTTP webhook (para integración con OpenClaw)
export const sendWhatsAppAlert = action({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { notificationId }) => {
    const notification = await ctx.runQuery(api.notifications.getById, { id: notificationId });
    
    if (!notification) {
      throw new Error("Notification not found");
    }

    const message = formatWhatsAppMessage(notification);
    
    // En producción, esto enviaría a un webhook de OpenClaw
    // Por ahora, solo logueamos
    console.log("📱 WhatsApp Alert:", message);
    
    return { success: true, message };
  },
});

// Query auxiliar para action
export const getById = query({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Helper: Formatear mensaje para WhatsApp
function formatWhatsAppMessage(notification: any): string {
  const emoji = notification.type === "blocked" ? "🚨" : "✅";
  const status = notification.type === "blocked" ? "BLOQUEADA" : "COMPLETADA";
  const assignees = notification.assigneeIds?.join(", ") || "Sin asignados";
  
  return `${emoji} *Mission Control Alert*

*Tarea:* ${notification.taskTitle}
*Estado:* ${status}
*Asignados:* ${assignees}
*Tiempo:* >10 minutos en este estado

${notification.type === "blocked" ? "⚠️ Requiere atención inmediata" : "🎉 Lista para revisión"}`;
}

// Mutation: Limpiar notificaciones viejas (mantenimiento)
export const cleanupOld = mutation({
  args: { olderThanHours: v.optional(v.number()) },
  handler: async (ctx, { olderThanHours = 24 }) => {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    const oldNotifications = await ctx.db.query("notifications")
      .filter((q) => q.lt(q.field("detectedAt"), cutoff))
      .filter((q) => q.eq(q.field("status"), "sent"))
      .collect();

    let deleted = 0;
    for (const notification of oldNotifications) {
      await ctx.db.delete(notification._id);
      deleted++;
    }

    return { deleted };
  },
});

// Query: Estadísticas de notificaciones
export const getStats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("notifications").collect();
    
    return {
      total: all.length,
      pending: all.filter(n => n.status === "pending").length,
      sent: all.filter(n => n.status === "sent").length,
      failed: all.filter(n => n.status === "failed").length,
      doneAlerts: all.filter(n => n.type === "done").length,
      blockedAlerts: all.filter(n => n.type === "blocked").length,
    };
  },
});
