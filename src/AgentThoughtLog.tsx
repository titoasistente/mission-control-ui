import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

interface ThoughtLog {
  _id: string;
  taskId: string;
  agentId: string;
  message: string;
  createdAt: number;
}

interface AgentThoughtLogProps {
  formatTimestamp: (ts?: number) => string;
  getAgentName: (id: string) => string;
  taskId?: string;
  limit?: number;
}

export default function AgentThoughtLog({ 
  formatTimestamp, 
  getAgentName,
  taskId,
  limit = 10 
}: AgentThoughtLogProps) {
  // Si hay taskId, mostrar pensamientos de esa tarea; si no, todos
  const taskCollaboration = useQuery(
    taskId ? api.collaboration.getTaskCollaboration : api.collaboration.getAllThoughtLogs,
    taskId ? { taskId } : {}
  ) ?? [];

  // Filtrar solo thought_logs y ordenar por fecha (más reciente primero)
  const thoughtLogs: ThoughtLog[] = (taskCollaboration as any[])
    .filter((event): event is ThoughtLog & { type: string } => 
      event?.type === 'thought_log' && !!event.message
    )
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);

  if (thoughtLogs.length === 0) {
    return (
      <div className="thought-log-empty" role="status" aria-live="polite">
        <p>🤔 Los agentes aún no han compartido pensamientos</p>
        <p className="hint">Aquí aparecerá el razonamiento de los agentes mientras trabajan.</p>
      </div>
    );
  }

  return (
    <div className="thought-log-container" role="log" aria-label="Pensamientos de agentes">
      <ul className="thought-log-list" role="list">
        {thoughtLogs.map((log, index) => (
          <li 
            key={log._id} 
            className="thought-log-item"
            style={{ animationDelay: `${index * 50}ms` }}
            role="listitem"
          >
            <div className="thought-log-header">
              <span className="thought-log-agent">
                <span aria-label="Pensamiento de agente" role="img">🧠</span>
                <span className="agent-name">{getAgentName(log.agentId)}</span>
              </span>
              <time className="thought-log-time" dateTime={new Date(log.createdAt).toISOString()}>
                {formatTimestamp(log.createdAt)}
              </time>
            </div>
            <p className="thought-log-message">{log.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
