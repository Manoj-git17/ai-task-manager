import {
  FiCheckCircle,
  FiAlertCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
} from "react-icons/fi";

export function ModernToastIcon({ type }) {
  switch (type) {
    case "success":
      return (
        <span
          className="modern-toast-icon-badge modern-toast-icon--success"
          aria-hidden="true"
        >
          <FiCheckCircle size={17} />
        </span>
      );
    case "error":
      return (
        <span
          className="modern-toast-icon-badge modern-toast-icon--error"
          aria-hidden="true"
        >
          <FiAlertCircle size={17} />
        </span>
      );
    case "warning":
      return (
        <span
          className="modern-toast-icon-badge modern-toast-icon--warning"
          aria-hidden="true"
        >
          <FiAlertTriangle size={17} />
        </span>
      );
    case "info":
      return (
        <span
          className="modern-toast-icon-badge modern-toast-icon--info"
          aria-hidden="true"
        >
          <FiInfo size={17} />
        </span>
      );
    default:
      return null;
  }
}

export function ModernCloseButton({ closeToast }) {
  return (
    <button
      type="button"
      onClick={closeToast}
      className="modern-toast-close-btn"
      aria-label="Close notification"
    >
      <FiX size={15} />
    </button>
  );
}
