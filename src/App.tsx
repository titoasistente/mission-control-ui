import { useState, useEffect } from "react";
import type { DragEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import Login from "./Login";
import TaskCard from "./TaskCard";
import './App.css'

function formatTimestamp(ts?: number): string {
  if (!ts) return '';
  const now = new Date();
  const diff = now.getTime() - ts;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
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

  // Get unique projects for filter
  const projects = [...new Set(tasks.map(t => t.projectId || t.project).filter(Boolean))] as string[];
  
  // Filter tasks by project
  const filteredTasks = projectFilter === 'all' 
    ? tasks 
    : tasks.filter(t => (t.projectId || t.project) === projectFilter);

  // Get last update across all tasks
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
    
    const reviewTasks = filteredTasks
      .filter(t => t.status === 'review')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const targetIndex = reviewTasks.findIndex(t => t._id === targetTaskId);
    const newOrder = targetIndex * 10;
    
    await reorderTask({ taskId: draggedTask, newOrder });
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
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
              {filteredTasks.filter(t => t.status === 'pending').map(task => (
                <TaskCard
                  key={task._id}
                  task={task}
                  getAgentName={getAgentName}
                  formatTimestamp={formatTimestamp}
                />
              ))}
            </div>
            <div className="task-column">
              <h3>⚡ In Progress</h3>
              {filteredTasks.filter(t => t.status === 'in_progress').map(task => (
                <TaskCard
                  key={task._id}
                  task={task}
                  getAgentName={getAgentName}
                  formatTimestamp={formatTimestamp}
                />
              ))}
            </div>
            <div className="task-column review-column">
              <h3>👀 Pending Review</h3>
              <p className="column-hint">Drag to reorder</p>
              {filteredTasks
                .filter(t => t.status === 'review')
                .sort((a, b) => (a.order || a.position || 0) - (b.order || b.position || 0))
                .map(task => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    draggable={true}
                    isDragging={draggedTask === task._id}
                    getAgentName={getAgentName}
                    formatTimestamp={formatTimestamp}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  />
                ))
              }
            </div>
            <div className="task-column">
              <h3>✅ Done</h3>
              {filteredTasks.filter(t => t.status === 'done').map(task => (
                <TaskCard
                  key={task._id}
                  task={task}
                  getAgentName={getAgentName}
                  formatTimestamp={formatTimestamp}
                />
              ))}
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
