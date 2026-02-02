import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// NOTE: Shuri's WhatsApp hook disabled - ctx.runAction not available in mutations
// Alternative: Use http action or client-side trigger

// Helper: Verificar si estamos en horario mute (23:00-08:00)
function isMuteHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 23 || hour < 8;
}

// Helper: Verificar si ha pasado suficiente tiempo desde la última notificación (30 min)
function shouldThrottle(lastNotificationAt: number | undefined): boolean {
  if (!lastNotificationAt) return false;
  const THROTTLE_MS = 30 * 60 * 1000; // 30 minutos
  return Date.now() - lastNotificationAt < THROTTLE_MS;
}

export const get = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const getByAssignee = query({
  args: { assigneeId: v.string() },
  handler: async (ctx, { assigneeId }) => {
    // Convex doesn't support direct array containment queries
    // Filter all tasks and check assigneeIds array in memory
    const allTasks = await ctx.db.query("tasks").collect();
    return allTasks.filter(t => t.assigneeIds?.includes(assigneeId));
  },
});

export const getByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    return await ctx.db.query("tasks")
      .filter((q) => q.eq(q.field("status"), status))
      .collect();
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

// Helper para validar si el requestor puede modificar el status
async function validateStatusTransition(
  ctx: any, 
  taskId: string, 
  requestorId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    return { allowed: false, reason: "Task not found" };
  }

  // Si no hay assignees, solo Fury puede mover a in_progress para asignar
  if (task.assigneeIds.length === 0) {
    if (requestorId === "fury") {
      return { allowed: true };
    }
    return { allowed: false, reason: "Task has no assignees. Only Fury can move it to assign resources." };
  }

  // Si el requestor es assignee, permitir
  if (task.assigneeIds.includes(requestorId)) {
    return { allowed: true };
  }

  // Fury puede cambiar prioridad/assignees pero NO status (excepto caso sin assignees arriba)
  if (requestorId === "fury") {
    return { allowed: false, reason: "Fury can only reprioritize/reassign, not change task status." };
  }

  return { allowed: false, reason: "Only assignees can change task status." };
}

export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.string(),
    requestorId: v.string(),
  },
  handler: async (ctx, { taskId, status, requestorId }) => {
    // Validar permisos
    const validation = await validateStatusTransition(ctx, taskId, requestorId);
    
    if (!validation.allowed) {
      // Log del intento denegado en collaborationEvents
      await ctx.db.insert("collaborationEvents", {
        taskId: taskId.toString(),
        type: "permission_denied",
        agentId: requestorId,
        message: `Permission denied: ${validation.reason}. Attempted status change to "${status}"`,
        metadata: {
          attemptedStatus: status,
          reason: validation.reason,
        },
        createdAt: Date.now(),
      });
      
      throw new Error(`Permission denied: ${validation.reason}`);
    }

    // Actualizar status
    const updateData: any = { 
      status,
      lastUpdated: Date.now()
    };

    // Si es aprobación (review → done), registrar quién aprobó
    if (status === "done") {
      updateData.approvedAt = Date.now();
      updateData.approvedBy = requestorId;
      // Reset notification tracking para permitir nueva alerta
      updateData.notificationSentAt = undefined;
      updateData.notificationType = undefined;
    }

    // Si cambia a blocked, resetear notificación para alertar
    if (status === "blocked") {
      updateData.notificationSentAt = undefined;
      updateData.notificationType = undefined;
    }

    // Obtener task actual para el hook de notificaciones
    const task = await ctx.db.get(taskId);
    
    await ctx.db.patch(taskId, updateData);

    // 🔔 Hook: WhatsApp Notification para done/blocked (DISABLED - requires http action)
    // TODO: Shuri - implementar como http action o client-side trigger
    // ctx.runAction no disponible en mutations
    if ((status === "done" || status === "blocked") && task) {
      // Log que se detectó el cambio (la notificación real se hará vía otra vía)
      await ctx.db.insert("collaborationEvents", {
        taskId: taskId.toString(),
        type: "thought_log",
        agentId: "shuri",
        message: `📱 WhatsApp notification trigger: task ${status} (mute: ${isMuteHours()}, lastNotif: ${task.notificationSentAt || 'none'})`,
        metadata: { 
          status, 
          muteHours: isMuteHours(),
          shouldNotify: !isMuteHours() && !shouldThrottle(task.notificationSentAt),
          throttled: shouldThrottle(task.notificationSentAt),
        },
        createdAt: Date.now(),
      });
    }

    // Log del cambio de status
    await ctx.db.insert("collaborationEvents", {
      taskId: taskId.toString(),
      type: "status_change",
      agentId: requestorId,
      message: `Status changed to "${status}"`,
      metadata: {
        newStatus: status,
        approvedBy: status === "done" ? requestorId : undefined,
      },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Mutation especial para Fury actualizar assignees (no status)
export const updateAssignees = mutation({
  args: {
    taskId: v.id("tasks"),
    assigneeIds: v.array(v.string()),
    requestorId: v.string(),
  },
  handler: async (ctx, { taskId, assigneeIds, requestorId }) => {
    // Solo Fury puede reasignar
    if (requestorId !== "fury") {
      throw new Error("Only Fury can reassign tasks.");
    }

    await ctx.db.patch(taskId, { 
      assigneeIds,
      lastUpdated: Date.now()
    });

    // Log de reasignación
    await ctx.db.insert("collaborationEvents", {
      taskId: taskId.toString(),
      type: "status_change",
      agentId: requestorId,
      message: `Task reassigned to: ${assigneeIds.join(", ")}`,
      metadata: {
        newAssignees: assigneeIds,
      },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Agregar definición de aprobación (LGTM tracking)
export const addDefinitionApproval = mutation({
  args: {
    taskId: v.id("tasks"),
    approverId: v.string(),
    requestorId: v.string(),
  },
  handler: async (ctx, { taskId, approverId, requestorId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Solo Fury puede registrar aprobaciones
    if (requestorId !== "fury") {
      throw new Error("Only Fury can manage definition approvals.");
    }

    const currentApprovals = task.definitionApprovals || [];
    
    // Evitar duplicados
    if (currentApprovals.includes(approverId)) {
      return { success: false, reason: "Already approved" };
    }

    const newApprovals = [...currentApprovals, approverId];
    
    await ctx.db.patch(taskId, {
      definitionApprovals: newApprovals,
      lastUpdated: Date.now(),
    });

    // Log de aprobación
    await ctx.db.insert("collaborationEvents", {
      taskId: taskId.toString(),
      type: "status_change",
      agentId: approverId,
      message: `${approverId} approved task definition`,
      metadata: {
        approvals: newApprovals,
        approvalsCount: newApprovals.length,
      },
      createdAt: Date.now(),
    });

    return { success: true, approvals: newApprovals };
  },
});
