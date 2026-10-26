import { toast } from "react-toastify";

/**
 * Modern notification for task completion / status toggle
 */
export function notifyTaskToggle(taskTitle, isCompleted) {
  const cleanTitle = (taskTitle || "Task").trim();
  const displayTitle =
    cleanTitle.length > 38 ? `${cleanTitle.slice(0, 38)}…` : cleanTitle;

  if (isCompleted) {
    toast.success(
      <div className="modern-toast-content">
        <div className="modern-toast-title">Task completed!</div>
        <div className="modern-toast-desc">{displayTitle}</div>
      </div>
    );
  } else {
    toast.info(
      <div className="modern-toast-content">
        <div className="modern-toast-title">Task reactivated</div>
        <div className="modern-toast-desc">{displayTitle} marked as active</div>
      </div>
    );
  }
}
