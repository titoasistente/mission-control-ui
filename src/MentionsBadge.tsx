import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

interface Mention {
  _id: Id<'collaborationEvents'>;
  _creationTime: number;
  taskId: string;
  agentId?: string;
  message?: string;
  createdAt?: number;
}

interface MentionsBadgeProps {
  agentName: string;
  getAgentName: (id: string) => string;
  formatTimestamp: (ts?: number | null) => string;
  onTaskClick?: (taskId: string) => void;
}

export function MentionsBadge({ agentName, getAgentName, formatTimestamp, onTaskClick }: MentionsBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Query para contador eficiente (solo número)
  const pendingCount = useQuery(api.collaboration.getPendingMentionsCount, { agentName }) ?? 0;
  
  // Query para lista completa (solo cuando está abierto)
  const pendingMentions = useQuery(
    api.collaboration.getPendingMentions, 
    isOpen ? { agentName } : "skip"
  ) ?? [];
  
  const resolveMention = useMutation(api.collaboration.resolveMention);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Cerrar con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleResolve = async (eventId: Id<'collaborationEvents'>, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await resolveMention({ eventId });
    } catch (err) {
      console.error('Failed to resolve mention:', err);
    }
  };

  const handleTaskClick = (taskId: string) => {
    setIsOpen(false);
    onTaskClick?.(taskId);
  };

  // No mostrar si no hay mentions
  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className="mentions-badge-container" ref={dropdownRef}>
      <button 
        className="mentions-badge"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`${pendingCount} mentions pendientes`}
        aria-live="polite"
        aria-expanded={isOpen}
      >
        <span className="mentions-icon">@</span>
        <span className="mentions-count">{pendingCount}</span>
      </button>

      {isOpen && (
        <div className="mentions-dropdown" role="menu">
          <div className="mentions-header">
            <h4>Menciones pendientes</h4>
            <button 
              className="mentions-close" 
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          
          {pendingMentions.length === 0 ? (
            <div className="mentions-empty">No hay menciones pendientes</div>
          ) : (
            <ul className="mentions-list" role="menu">
              {pendingMentions.map((mention: Mention) => (
                <li 
                  key={String(mention._id)} 
                  className="mention-item"
                  role="menuitem"
                >
                  <div 
                    className="mention-content"
                    onClick={() => handleTaskClick(mention.taskId)}
                  >
                    <div className="mention-meta">
                      <span className="mention-from">
                        @{getAgentName(mention.agentId || 'unknown')}
                      </span>
                      <span className="mention-time">
                        {formatTimestamp(mention.createdAt)}
                      </span>
                    </div>
                    <p className="mention-text">
                      {mention.message?.substring(0, 100)}
                      {(mention.message?.length || 0) > 100 ? '...' : ''}
                    </p>
                    <span className="mention-task-link">Ver tarea →</span>
                  </div>
                  <button
                    className="mention-resolve-btn"
                    onClick={(e) => handleResolve(mention._id, e)}
                    title="Marcar como resuelta"
                    aria-label="Marcar como resuelta"
                  >
                    ✓
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
