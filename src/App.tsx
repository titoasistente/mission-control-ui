import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import Login from "./Login";
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
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

  const statusColors: Record<string, string> = {
    idle: '#4ade80',
    working: '#f97316',
    blocked: '#ef4444',
    done: '#3b82f6'
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="dashboard">
      <header>
        <h1>⚡ Mission Control Squad</h1>
        <p className="subtitle">AI Agent Coordination Dashboard</p>
        <button onClick={() => { localStorage.removeItem('squad_access'); window.location.reload(); }} style={{ background: 'transparent', border: '1px solid #444', color: '#666', fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}>Logout</button>
      </header>

      <div className="content">
        <section className="tasks-section">
          <h2>🗂️ Task Board</h2>
          <div className="task-columns">
            <div className="task-column">
              <h3>📋 Pending</h3>
              {tasks.filter(t => t.status === 'pending').map(task => (
                <div key={task._id} className="task-card">
                  <h4>{task.title}</h4>
                  <p>{task.description}</p>
                </div>
              ))}
            </div>
            <div className="task-column">
              <h3>⚡ In Progress</h3>
              {tasks.filter(t => t.status === 'in_progress').map(task => (
                <div key={task._id} className="task-card working">
                  <h4>{task.title}</h4>
                  <p>{task.description}</p>
                </div>
              ))}
            </div>
            <div className="task-column">
              <h3>👀 Pending Review</h3>
              {tasks.filter(t => t.status === 'pending_review').map(task => (
                <div key={task._id} className="task-card review">
                  <h4>{task.title}</h4>
                  <p>{task.description}</p>
                </div>
              ))}
            </div>
            <div className="task-column">
              <h3>✅ Done</h3>
              {tasks.filter(t => t.status === 'done').map(task => (
                <div key={task._id} className="task-card done">
                  <h4>{task.title}</h4>
                  <p>{task.description}</p>
                </div>
              ))}
            </div>
          </div>
          {tasks.length === 0 && <p className="empty">No hay tareas cargadas. El Squad está en espera.</p>}
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
