import { useState } from "react";
import type { DragEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export interface Task {
  _id: Id<"tasks">;
  _creationTime?: number;
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

interface Comment {
  _id: Id<"comments">;
  taskId: string;
  author: string;
  text: string;
  createdAt?: number;
  timestamp?: number;
}

interface TaskCardProps {
  task: Task;
  draggable?: boolean;
  isDragging?: boolean;
  getAgentName: (id: string) => string;
  formatTimestamp: (ts?: number) => string;
  onDragStart?: (e: DragEvent, taskId: Id<"tasks">) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent, taskId: Id<"tasks">) => void;
  onDragEnd?: () => void;
  onClick?: (task: Task) => void;
  onApprove?: (taskId: Id<"tasks">) => void;
  canApprove?: boolean;
}

// Safe ISO string formatter
function safeISOString(ts: unknown): string {
  if (ts == null) return new Date().toISOString();
  const num = Number(ts);
  if (isNaN(num) || num <= 0) return new Date().toISOString();
  return new Date(num).toISOString();
}

export default function TaskCard({
  task,
  draggable = false,
  isDragging = false,
  getAgentName,
  formatTimestamp,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClick,
  onApprove,
  canApprove = false,
}: TaskCardProps) {
  const [showComments, setShowComments] = useState(false);
  
  // Handle case where task might be null/undefined or missing critical fields
  if (!task || !task._id) {
    return (
      <article className="task-card error">
        <h4>⚠️ Invalid Task</h4>
        <p>Task data is corrupted or missing</p>
      </article>
    );
  }

  // Safe query with error boundary protection
  let allComments: Comment[] = [];
  try {
    const queryResult = useQuery(api.comments.getAll);
    allComments = (queryResult ?? []) as Comment[];
  } catch (e) {
    console.error("Error loading comments:", e);
    allComments = [];
  }
  
  const taskComments = allComments.filter(c => c.taskId === String(task._id));
  
  const statusClass = task.status === 'in_progress' ? 'working' 
    : task.status === 'review' ? 'review'
    : task.status === 'done' ? 'done' : '';

  const statusLabel = task.status === 'in_progress' ? 'In Progress' 
    : task.status === 'review' ? 'Pending Review'
    : task.status === 'done' ? 'Done' : 'Pending';

  // Safe accessor for title/description
  const title = task.title ?? 'Untitled Task';
  const description = task.description ?? '';
  const assigneeIds = task.assigneeIds ?? [];

  const handleClick = () => {
    if (onClick) {
      onClick(task);
    }
  };

  return (
    <article 
      className={`task-card ${statusClass} ${isDragging ? 'dragging' : ''} ${onClick ? 'clickable' : ''}`}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, task._id) : undefined}
      onDragOver={draggable && onDragOver ? onDragOver : undefined}
      onDrop={draggable && onDrop ? (e) => onDrop(e, task._id) : undefined}
      onDragEnd={draggable && onDragEnd ? onDragEnd : undefined}
      onClick={handleClick}
      role={draggable ? "listitem" : "button"}
      aria-label={`Task: ${title}. Status: ${statusLabel}`}
      tabIndex={draggable ? 0 : undefined}
    >
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      
      {(task.projectId || task.project) && (
        <div className="task-project">📁 {task.projectId || task.project}</div>
      )}
      
      {assigneeIds.length > 0 && (
        <div className="task-assignees">
          👤 {assigneeIds.map(id => getAgentName(id)).join(', ')}
        </div>
      )}
      
      {(task.lastUpdate || task.lastUpdated) && (
        <div className="task-timestamp">
          🕐 {formatTimestamp(task.lastUpdate || task.lastUpdated)}
        </div>
      )}
      
      {taskComments.length > 0 && (
        <section className="task-comments-section" aria-label="Task comments">
          <button 
            className="comments-toggle"
            onClick={() => setShowComments(!showComments)}
            aria-expanded={showComments}
            aria-controls={`comments-${task._id}`}
          >
            💬 {taskComments.length} comment{taskComments.length !== 1 ? 's' : ''} {showComments ? '▾' : '▸'}
          </button>
          
          {showComments && (
            <div 
              id={`comments-${task._id}`}
              className="comments-thread"
              role="log"
              aria-live="polite"
            >
              {taskComments
                .sort((a, b) => {
                  const aTime = Number(a?.createdAt ?? a?.timestamp ?? 0);
                  const bTime = Number(b?.createdAt ?? b?.timestamp ?? 0);
                  return aTime - bTime;
                })
                .map(comment => {
                  if (!comment || !comment._id) return null;
                  const commentText = comment.text ?? 'No content';
                  const commentAuthor = comment.author ?? 'Unknown';
                  return (
                    <div key={comment._id} className="comment">
                      <div className="comment-header">
                        <span className="comment-author">{commentAuthor}</span>
                        <time 
                          className="comment-time" 
                          dateTime={safeISOString(comment.createdAt ?? comment.timestamp)}
                        >
                          {formatTimestamp(comment.createdAt ?? comment.timestamp)}
                        </time>
                      </div>
                      <p className="comment-text">{commentText}</p>
                    </div>
                  );
                })
              }
            </div>
          )}
        </section>
      )}
      
      {/* Approve Button - Only for Review column */}
      {task.status === 'review' && onApprove && (
        <button
          className="approve-btn"
          onClick={(e) => {
            e.stopPropagation();
            onApprove(task._id);
          }}
          disabled={!canApprove}
          aria-label="Approve and move to Done"
        >
          ✅ Approve
        </button>
      )}
    </article>
  );
}
