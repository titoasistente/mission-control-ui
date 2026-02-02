import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface Task {
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

// Agent type for future use
// interface Agent {
//   _id: Id<"agents">;
//   name?: string;
//   role?: string;
// }

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  getAgentName: (id: string) => string;
  formatTimestamp: (ts?: number) => string;
}

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  getAgentName,
  formatTimestamp,
}: TaskDetailModalProps) {
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "comments" | "timeline">("overview");
  
  // Safe query with error boundary protection
  let taskComments: Comment[] = [];
  try {
    const queryResult = useQuery(api.comments.getAll);
    taskComments = ((queryResult ?? []) as Comment[]).filter(
      c => task && c.taskId === String(task._id)
    );
  } catch (e) {
    console.error("Error loading comments:", e);
    taskComments = [];
  }

  const addComment = useMutation(api.comments.add);

  const handleAddComment = useCallback(async () => {
    if (!task || !newComment.trim()) return;
    
    try {
      await addComment({
        taskId: String(task._id),
        author: "friday", // Current agent
        text: newComment.trim(),
      });
      setNewComment("");
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  }, [task, newComment, addComment]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleAddComment();
    }
  };

  if (!isOpen || !task) return null;

  const statusClass = task.status === 'in_progress' ? 'working' 
    : task.status === 'review' ? 'review'
    : task.status === 'done' ? 'done' 
    : 'pending';

  const statusLabel = task.status === 'in_progress' ? 'In Progress' 
    : task.status === 'review' ? 'Pending Review'
    : task.status === 'done' ? 'Done' 
    : 'Pending';

  const assigneeIds = task.assigneeIds ?? [];

  // Timeline events
  const timelineEvents = [
    { type: "created" as const, label: "Task created", time: task._creationTime || 0 },
    ...(task.lastUpdated && task.lastUpdated !== task._creationTime 
      ? [{ type: "updated" as const, label: "Last updated", time: task.lastUpdated }] 
      : []),
    ...taskComments.map(c => ({ 
      type: "comment" as const, 
      label: `Comment by ${c.author}`, 
      time: c.createdAt || c.timestamp || 0,
      text: c.text
    })),
  ].sort((a, b) => b.time - a.time);

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
      >
        <header className="modal-header">
          <div className="modal-title-section">
            <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
            <h2 id="modal-title" className="modal-title">{task.title}</h2>
          </div>
          <button 
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </header>

        <nav className="modal-tabs">
          <button 
            className={`tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📋 Overview
          </button>
          <button 
            className={`tab ${activeTab === "comments" ? "active" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            💬 Comments ({taskComments.length})
          </button>
          <button 
            className={`tab ${activeTab === "timeline" ? "active" : ""}`}
            onClick={() => setActiveTab("timeline")}
          >
            📜 Timeline
          </button>
        </nav>

        <div className="modal-body">
          {activeTab === "overview" && (
            <div className="tab-content overview-tab">
              <section className="detail-section">
                <h3>Description</h3>
                <p className="description-text">{task.description || "No description provided."}</p>
              </section>

              <div className="detail-grid">
                <section className="detail-section">
                  <h3>Assignees</h3>
                  {assigneeIds.length > 0 ? (
                    <div className="assignee-list">
                      {assigneeIds.map(id => (
                        <span key={id} className="assignee-chip">
                          👤 {getAgentName(id)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-text">No assignees</p>
                  )}
                </section>

                <section className="detail-section">
                  <h3>Project</h3>
                  <p className="project-text">
                    {task.projectId || task.project ? `📁 ${task.projectId || task.project}` : "No project assigned"}
                  </p>
                </section>
              </div>

              <section className="detail-section">
                <h3>Activity</h3>
                <div className="activity-meta">
                  <p><strong>Created:</strong> {formatTimestamp(task._creationTime)}</p>
                  {(task.lastUpdate || task.lastUpdated) && (
                    <p><strong>Last update:</strong> {formatTimestamp(task.lastUpdate || task.lastUpdated)}</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "comments" && (
            <div className="tab-content comments-tab">
              <div className="comments-list">
                {taskComments.length > 0 ? (
                  taskComments
                    .sort((a, b) => {
                      const aTime = Number(a?.createdAt ?? a?.timestamp ?? 0);
                      const bTime = Number(b?.createdAt ?? b?.timestamp ?? 0);
                      return bTime - aTime; // Newest first
                    })
                    .map(comment => (
                      <div key={comment._id} className="comment-item">
                        <div className="comment-header">
                          <span className="comment-author">{comment.author}</span>
                          <time className="comment-time">
                            {formatTimestamp(comment.createdAt || comment.timestamp)}
                          </time>
                        </div>
                        <p className="comment-text">{comment.text}</p>
                      </div>
                    ))
                ) : (
                  <p className="empty-text">No comments yet. Be the first to comment!</p>
                )}
              </div>
              
              <div className="comment-input-section">
                <textarea
                  className="comment-input"
                  placeholder="Add a comment... (Ctrl+Enter to submit)"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                />
                <button 
                  className="comment-submit"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  Add Comment
                </button>
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="tab-content timeline-tab">
              <ul className="timeline-list">
                {timelineEvents.map((event, idx) => (
                  <li key={idx} className={`timeline-item ${event.type}`}>
                    <div className="timeline-marker">
                      {event.type === "created" && "📝"}
                      {event.type === "updated" && "🔄"}
                      {event.type === "comment" && "💬"}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-label">{event.label}</span>
                        <time className="timeline-time">{formatTimestamp(event.time)}</time>
                      </div>
                      {'text' in event && event.text && (
                        <p className="timeline-text">{event.text}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
