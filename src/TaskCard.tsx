import { useState, DragEvent } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

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
}: TaskCardProps) {
  const [showComments, setShowComments] = useState(false);
  
  const allComments = useQuery(api.comments.getAll) ?? [];
  const taskComments = allComments.filter(c => c.taskId === task._id);
  
  const statusClass = task.status === 'in_progress' ? 'working' 
    : task.status === 'pending_review' ? 'review'
    : task.status === 'done' ? 'done' : '';

  return (
    <div 
      className={`task-card ${statusClass} ${isDragging ? 'dragging' : ''}`}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, task._id) : undefined}
      onDragOver={draggable && onDragOver ? onDragOver : undefined}
      onDrop={draggable && onDrop ? (e) => onDrop(e, task._id) : undefined}
      onDragEnd={draggable && onDragEnd ? onDragEnd : undefined}
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
      
      {taskComments.length > 0 && (
        <div className="task-comments-section">
          <button 
            className="comments-toggle"
            onClick={() => setShowComments(!showComments)}
          >
            💬 {taskComments.length} comment{taskComments.length !== 1 ? 's' : ''} {showComments ? '▾' : '▸'}
          </button>
          
          {showComments && (
            <div className="comments-thread">
              {taskComments
                .sort((a, b) => (a.createdAt || a.timestamp || 0) - (b.createdAt || b.timestamp || 0))
                .map(comment => (
                  <div key={comment._id} className="comment">
                    <div className="comment-header">
                      <span className="comment-author">{comment.author}</span>
                      <span className="comment-time">
                        {formatTimestamp(comment.createdAt || comment.timestamp)}
                      </span>
                    </div>
                    <div className="comment-text">{comment.text}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}
