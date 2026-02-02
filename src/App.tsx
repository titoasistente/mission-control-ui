import { useState, useEffect, DragEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import Login from "./Login";
import './App.css'

interface Task {
  _id: Id<"tasks">;
  title: string;
  description: string;
  status: string;
  assigneeIds: string[];
  project?: string;
  projectId?: string;
  order?: number;
  position?: number;
  lastUpdated?: number;
  lastUpdate?: number;
}

interface Agent {
  _id: Id<"agents">;
  name: string;
  role: string;
  status: string;
}

function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [draggedTask, setDraggedTask] = useState<Id<"tasks"> | null>(null);
  
  useEffect(() => {
    if (localStorage.getItem('squad_access') === '1539') {
      console.log('Access Granted'); setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (pass: string) => {
    if (pass === '1539') {
      localStorage.setItem('squad_access', '1539');
      console.log('Access Granted'); setIsAuthenticated(true);
    } else {
      alert('Access Denied');
    }
  };

  const tasks = useQuery(api.tasks.get) ?? [];
  const agents = useQuery(api.agents.get) ?? [];
  const reorderTask = useMutation(api.tasks.reorder);

  // Get unique projects for filter (support both project and projectId)
  const projects = [...new Set(tasks.map(t => t.projectId || t.project).filter(Boolean))] as string[];
  
  // Filter tasks by project
  const filteredTasks = projectFilter === 'all' 
    ? tasks 
    : tasks.filter(t => (t.projectId || t.project) === projectFilter);

  // Get last update across all tasks (support both lastUpdate and lastUpdated)
  const lastGlobalUpdate = Math.max(...tasks.map(t => t.lastUpdate || t.lastUpdated || 0), 0);

  const statusColors: Record<string, string> = {
    idle: '#4ade80',
    working: '#f97316',
    blocked: '#ef4444',
    done: '#3b82f6'
  };

  // Get agent name by ID
  const getAgentName = (id: string) => {
    const agent = agents.find(a => a._id === id);
    return agent?.name || id;
  };

  // Drag & Drop handlers (only for Pending Review column)
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
    
    const reviewTasks = filteredTasks
      .filter(t => t.status === 'pending_review')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const targetIndex = reviewTasks.findIndex(t => t._id === targetTaskId);
    const newOrder = targetIndex * 10;
    
    await reorderTask({ taskId: draggedTask, newOrder });
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const renderTaskCard = (task: Task, draggable: boolean = false) => {
    const statusClass = task.status === 'in_progress' ? 'working' 
      : task.status === 'pending_review' ? 'review'
      : task.status === 'done' ? 'done' : '';
    
    return (
      <div 
        key={task._id} 
        className={`task-card ${statusClass} ${draggedTask === task._id ? 'dragging' : ''}`}
        draggable={draggable}
        onDragStart={draggable ? (e) => handleDragStart(e, task._id) : undefined}
        onDragOver={draggable ? handleDragOver : undefined}
        onDrop={draggable ? (e) => handleDrop(e, task._id) : undefined}
        onDragEnd={draggable ? handleDragEnd : undefined}
      >
        <h4>{task.title}</h4>
        <p>{task.description}</p>
        
        {(task.projectId || task.project) && (
          <div className="task-project">📁 {task.projectId || task.project}</div>
        )}
        
        {task.assigneeIds && task.assigneeIds.length > 0 && (
          <div className="task-assignees">
            👤 {task.assigneeIds.map(id => getAgentName(id)).join(', ')}
          </div>
        )}
        
        {(task.lastUpdate || task.lastUpdated) && (
          <div className="task-timestamp">🕐 {formatTimestamp(task.lastUpdate || task.lastUpdated)}</div>
        )}
      </div>
    );
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

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
          <button onClick={() => { localStorage.removeItem('squad_access'); window.location.reload(); }} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="content">
        <section className="tasks-section">
          <h2>🗂️ Task Board</h2>
          <div className="task-columns">
            <div className="task-column">
              <h3>📋 Pending</h3>
              {filteredTasks.filter(t => t.status === 'pending').map(task => 
                renderTaskCard(task)
              )}
            </div>
            <div className="task-column">
              <h3>⚡ In Progress</h3>
              {filteredTasks.filter(t => t.status === 'in_progress').map(task => 
                renderTaskCard(task)
              )}
            </div>
            <div className="task-column review-column">
              <h3>👀 Pending Review</h3>
              <p className="column-hint">Drag to reorder</p>
              {filteredTasks
                .filter(t => t.status === 'pending_review')
                .sort((a, b) => (a.order || a.position || 0) - (b.order || b.position || 0))
                .map(task => renderTaskCard(task, true))
              }
            </div>
            <div className="task-column">
              <h3>✅ Done</h3>
              {filteredTasks.filter(t => t.status === 'done').map(task => 
                renderTaskCard(task)
              )}
            </div>
          </div>
          {filteredTasks.length === 0 && <p className="empty">No hay tareas cargadas. El Squad está en espera.</p>}
        </section>

        <aside className="agents-section">
          <h2>🤖 AI Squad</h2>
          {agents.map(agent => (
            <div key={agent._id} className="agent-card">
              <div className="agent-status" style={{ background: statusColors[agent.status] || '#666' }}></div>
              <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                <div className="agent-role">{agent.role}</div>
              </div>
            </div>
          ))}
          {agents.length === 0 && <p className="empty">Cargando agentes...</p>}
        </aside>
      </div>
    </div>
  )
}

export default App
