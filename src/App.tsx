import { useState, useEffect, useMemo } from "react";
import type { DragEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import Login from "./Login";
import TaskCard, { type Task } from "./TaskCard";
import TaskDetailModal from "./TaskDetailModal";
import './App.css'

// Safe timestamp formatter
function formatTimestamp(ts?: number | null): string {
  if (ts == null || isNaN(ts) || ts <= 0) return '';
  const now = new Date();
  const diff = now.getTime() - ts;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// Type definitions for safe data handling
interface SafeTask {
  _id: Id<"tasks">;
  _creationTime: number;
  title: string;
  description: string;
  status: string;
  assigneeIds?: string[];
  project?: string;
  projectId?: string;
  order?: number;
  position?: number;
  lastUpdated?: number;
  lastUpdate?: number;
}

interface SafeAgent {
  _id: Id<"agents">;
  _creationTime: number;
  name?: string;
  role?: string;
  status?: string;
  sessionKey?: string;
}

// Allowlist de usuarios que pueden aprobar tareas
const CAN_APPROVE_ROLES = ['luke', 'chief_of_staff'];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [draggedTask, setDraggedTask] = useState<Id<"tasks"> | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  useEffect(() => {
    if (localStorage.getItem('squad_access') === '1539') {
      const savedRole = localStorage.getItem('squad_role') || 'viewer';
      console.log('Access Granted'); 
      setIsAuthenticated(true);
      setUserRole(savedRole);
    }
  }, []);

  const handleLogin = (pass: string, role?: string) => {
    if (pass === '1539') {
      const userRole = role || 'viewer';
      localStorage.setItem('squad_access', '1539');
      localStorage.setItem('squad_role', userRole);
      console.log('Access Granted as:', userRole); 
      setIsAuthenticated(true);
      setUserRole(userRole);
    } else {
      alert('Access Denied');
    }
  };
  
  // Determinar si el usuario puede aprovar tareas
  const canApprove = CAN_APPROVE_ROLES.includes(userRole);

  // Safe query results with proper defaults
  const rawTasks = useQuery(api.tasks.get) ?? [];
  const rawAgents = useQuery(api.agents.get) ?? [];
  const reorderTask = useMutation(api.tasks.reorder);
  const updateTaskStatus = useMutation(api.tasks.updateStatus);

  // Defensive data normalization
  const tasks: SafeTask[] = useMemo(() => {
    if (!Array.isArray(rawTasks)) return [];
    return rawTasks
      .filter(t => {
        // Validate minimal required fields
        if (!t || typeof t !== 'object') return false;
        if (!('_id' in t)) return false;
        if (!('title' in t)) return false;
        return true;
      })
      .map(t => ({
        ...t,
        // Ensure optional arrays are actually arrays
        assigneeIds: Array.isArray(t.assigneeIds) ? t.assigneeIds : [],
        // Ensure strings are strings
        title: String(t.title ?? ''),
        description: String(t.description ?? ''),
        status: String(t.status ?? 'pending'),
      }));
  }, [rawTasks]);

  const agents: SafeAgent[] = useMemo(() => {
    if (!Array.isArray(rawAgents)) return [];
    return rawAgents.filter(a => {
      if (!a || typeof a !== 'object') return false;
      if (!('_id' in a)) return false;
      return true;
    });
  }, [rawAgents]);

  // Get unique projects for filter
  const projects = useMemo(() => {
    return [...new Set(tasks.map(t => t.projectId || t.project).filter(Boolean))] as string[];
  }, [tasks]);
  
  // Filter tasks by project
  const filteredTasks = useMemo(() => {
    if (projectFilter === 'all') return tasks;
    return tasks.filter(t => (t.projectId || t.project) === projectFilter);
  }, [tasks, projectFilter]);

  // Get last update across all tasks
  const lastGlobalUpdate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.max(...tasks.map(t => t.lastUpdate || t.lastUpdated || 0), 0);
  }, [tasks]);

  const statusColors: Record<string, string> = {
    idle: '#4ade80',
    working: '#f97316',
    blocked: '#ef4444',
    done: '#3b82f6'
  };

  // Get agent name by ID with fallback
  const getAgentName = (id: string): string => {
    if (!id) return 'Unknown';
    const agent = agents.find(a => a._id === id);
    return agent?.name?.trim() || id;
  };

  // Drag & Drop handlers
  const handleDragStart = (e: DragEvent, taskId: Id<"tasks">) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: DragEvent, targetTaskId: Id<"tasks">) => {
    e.preventDefault();
    if (!draggedTask || draggedTask === targetTaskId) return;
    
    const pendingTasksSorted = filteredTasks
      .filter(t => t.status === 'pending')
      .sort((a, b) => (a.order || a.position || 0) - (b.order || b.position || 0));
    
    const targetIndex = pendingTasksSorted.findIndex(t => t._id === targetTaskId);
    const newOrder = targetIndex * 10;
    
    try {
      await reorderTask({ taskId: draggedTask, newOrder });
    } catch (err) {
      console.error('Failed to reorder task:', err);
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleApproveTask = async (taskId: Id<"tasks">) => {
    try {
      await updateTaskStatus({ taskId, status: 'done', requestorId: userRole });
    } catch (err) {
      console.error('Failed to approve task:', err);
      alert('Failed to approve task. Check console.');
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Safe filtering for task columns
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress');
  const reviewTasks = filteredTasks
    .filter(t => t.status === 'review')
    .sort((a, b) => (a.order || a.position || 0) - (b.order || b.position || 0));
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  return (
    <div className="dashboard">
      <header>
        <h1>⚡ Mission Control Squad</h1>
        <p className="subtitle">AI Agent Coordination Dashboard</p>
        {lastGlobalUpdate > 0 && (
          <p className="last-update">Last update: {formatTimestamp(lastGlobalUpdate)}</p>
        )}
        
        <div className="header-controls">
          {projects.length > 0 && (
            <select 
              className="project-filter"
              value={projectFilter} 
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <button 
            onClick={() => { 
              localStorage.removeItem('squad_access'); 
              localStorage.removeItem('squad_role');
              window.location.reload(); 
            }} 
            className="logout-btn"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="content">
        <section className="tasks-section">
          <h2>🗂️ Task Board</h2>
          <div className="task-columns">
            <div className="task-column pending-column">
              <h3>📋 Pending</h3>
              <p className="column-hint">Drag to prioritize</p>
              {pendingTasks.sort((a, b) => (a.order || a.position || 0) - (b.order || b.position || 0)).map(task => (
                <TaskCard
                  key={String(task._id)}
                  task={task}
                  draggable={true}
                  isDragging={draggedTask === task._id}
                  getAgentName={getAgentName}
                  formatTimestamp={formatTimestamp}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onClick={handleTaskClick}
                />
              ))}
            </div>
            <div className="task-column">
              <h3>⚡ In Progress</h3>
              {inProgressTasks.map(task => (
                <TaskCard
                  key={String(task._id)}
                  task={task}
                  getAgentName={getAgentName}
                  formatTimestamp={formatTimestamp}
                  onClick={handleTaskClick}
                />
              ))}
            </div>
            <div className="task-column review-column">
              <h3>👀 Pending Review</h3>
              {reviewTasks.map(task => (
                <TaskCard
                  key={String(task._id)}
                  task={task}
                  getAgentName={getAgentName}
                  formatTimestamp={formatTimestamp}
                  onClick={handleTaskClick}
                  onApprove={handleApproveTask}
                  canApprove={canApprove}
                />
              ))}
            </div>
            <div className="task-column">
              <h3>✅ Done</h3>
              {doneTasks.map(task => (
                <TaskCard
                  key={String(task._id)}
                  task={task}
                  getAgentName={getAgentName}
                  formatTimestamp={formatTimestamp}
                  onClick={handleTaskClick}
                />
              ))}
            </div>
          </div>
          {filteredTasks.length === 0 && <p className="empty">No hay tareas cargadas. El Squad está en espera.</p>}
        </section>

        <aside className="agents-section">
          <h2>🤖 AI Squad</h2>
          {agents.map(agent => {
            // Find current task for this agent (in_progress status)
            const agentId = agent.name?.toLowerCase() || '';
            const currentTask = filteredTasks.find(t => 
              t.status === 'in_progress' && 
              t.assigneeIds?.some(id => id.toLowerCase() === agentId)
            );
            
            return (
              <div key={String(agent._id)} className="agent-card">
                <div 
                  className="agent-status" 
                  style={{ background: statusColors[agent.status || ''] || '#666' }}
                ></div>
                <div className="agent-info">
                  <div className="agent-name">{agent.name || 'Unnamed Agent'}</div>
                  <div className="agent-role">{agent.role || 'Unknown Role'}</div>
                  {currentTask && (
                    <div 
                      className="agent-current-task"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskClick(currentTask as Task);
                      }}
                      title="Click to view task details"
                    >
                      <span className="task-indicator">⚡</span>
                      <span className="task-title">{currentTask.title}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {agents.length === 0 && <p className="empty">Cargando agentes...</p>}
        </aside>
      </div>

      <TaskDetailModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        getAgentName={getAgentName}
        formatTimestamp={formatTimestamp}
      />
    </div>
  )
}

export default App
