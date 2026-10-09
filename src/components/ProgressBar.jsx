function ProgressBar({ total, completed }) {
  const percentage = total === 0 ? 0 : (completed / total) * 100;

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span className="progress-text">
          {completed} of {total} tasks completed
        </span>
        <span className="progress-percentage">{Math.round(percentage)}%</span>
      </div>

      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Task completion progress"
      >
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default ProgressBar;