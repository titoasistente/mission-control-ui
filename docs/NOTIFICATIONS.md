# 📱 Proactive Notification System

Sistema de alertas automáticas vía WhatsApp para tareas Done o Blocked > 10 minutos.

---

## 🏗️ Arquitectura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Convex    │────>│  Cron Job   │────>│   WhatsApp  │
│   Tasks     │     │  Detector   │     │   Alert     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│notifications│────>│  Process    │────>│    Luke     │
│    table    │     │  Pending    │     │  (WhatsApp) │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 📋 Schema

### Tabla `notifications`
- `taskId`: ID de la tarea
- `type`: "done" | "blocked"
- `status`: "pending" | "sent" | "failed"
- `taskTitle`, `taskStatus`, `assigneeIds`
- `detectedAt`, `sentAt`, `retryCount`

### Campos agregados a `tasks`
- `notificationSentAt`: Timestamp de última notificación
- `notificationType`: Tipo de última notificación

---

## ⚡ Funciones Convex

### `notifications:detectStuckTasks`
Detecta tareas Done/Blocked con >10 minutos y crea registros de notificación.

```bash
npx convex run --prod notifications:detectStuckTasks
```

### `notifications:processPending`
Procesa notificaciones pendientes y las marca como enviadas.

```bash
npx convex run --prod notifications:processPending
```

### `notifications:getPending`
Lista notificaciones pendientes.

### `notifications:getStats`
Estadísticas del sistema.

---

## ⏰ Cron Job Setup (OpenClaw)

Configurar en OpenClaw para ejecutar cada 5 minutos:

```json
{
  "name": "mission-control-notifications",
  "schedule": { "kind": "every", "everyMs": 300000 },
  "payload": {
    "kind": "agentTurn",
    "message": "Run Mission Control notification check: cd ~/squad/mission-control-ui && npx convex run --prod notifications:detectStuckTasks && npx convex run --prod notifications:processPending"
  },
  "sessionTarget": "isolated"
}
```

---

## 📱 Formato de Alerta WhatsApp

```
🚨 *Mission Control Alert*

*Tarea:* {title}
*Estado:* BLOQUEADA
*Asignados:* {assignees}
*Tiempo:* >10 minutos

⚠️ Requiere atención inmediata
```

---

## 🔧 Integración WhatsApp Real

Para enviar mensajes reales de WhatsApp, extender `processPending` para llamar:

```typescript
// En OpenClaw gateway
await fetch('http://localhost:8080/api/message', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    channel: 'whatsapp',
    target: 'luke',
    message: formattedMessage
  })
});
```

---

## 📊 Monitoreo

```bash
# Ver notificaciones pendientes
npx convex run --prod notifications:getPending

# Ver estadísticas
npx convex run --prod notifications:getStats

# Limpieza de notificaciones viejas
npx convex run --prod notifications:cleanupOld '{"olderThanHours": 24}'
```

---

## ✅ Status

- [x] Schema de notificaciones
- [x] Funciones de detección
- [x] Funciones de procesamiento
- [x] Tracking en tasks
- [x] Logs de colaboración
- [ ] Cron job configurado en OpenClaw
- [ ] Webhook WhatsApp real
- [ ] Testing end-to-end

---

**Implementado por:** Loki (DevOps)  
**Fecha:** 2026-02-02
