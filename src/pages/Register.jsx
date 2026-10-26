import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUser,
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiShield,
  FiAlertTriangle,
} from "react-icons/fi";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api"
  ).replace(/\/+$/, "");

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (cleanName.length > 100) {
      setError("Name must not exceed 100 characters.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password.length > 72) {
      setError("Password must not exceed 72 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          setError(
            "An account with this email already exists. Please log in."
          );
        } else {
          setError(data.message || "Unable to create your account.");
        }

        return;
      }

      // Automatically sign in after successful registration.
      if (data.token && data.user) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        navigate("/", { replace: true });
        return;
      }

      // Support backends that register without returning a token.
      navigate("/login", {
        replace: true,
        state: {
          message: "Account created successfully. Please log in.",
        },
      });
    } catch (err) {
      console.error("Registration error:", err);

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      {/* Dynamic Background Light Layers */}
      <div className="auth-ambient-orb auth-ambient-orb-primary" aria-hidden="true" />
      <div className="auth-ambient-orb auth-ambient-orb-secondary" aria-hidden="true" />
      <div className="auth-grid-overlay" aria-hidden="true" />

      <div className="login-card">
        <div className="login-header">
          {/* Status Badge */}
          <div className="auth-chip" aria-hidden="true">
            <span className="auth-chip-dot" />
            <span>Enterprise Workspace</span>
          </div>

          <div className="login-brand-icon" aria-hidden="true">
            <svg
              className="brand-orchestrator-glyph"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: "36px", height: "36px" }}
            >
              <defs>
                <linearGradient id="tfGradReg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="50%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
              </defs>
              <rect
                x="2"
                y="2"
                width="28"
                height="28"
                rx="8"
                fill="#0F1219"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
              />
              <path
                d="M8 17L13 22L24 10"
                stroke="url(#tfGradReg)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="10" r="2" fill="#A78BFA" />
            </svg>
          </div>

          <h1>Create Account</h1>
          <p>Start organizing your tasks with TaskFlow.</p>
        </div>

        {error && (
          <div className="form-error" role="alert" aria-live="polite">
            <FiAlertTriangle className="form-error-icon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-field">
            <label htmlFor="register-name">Full Name</label>

            <div className="login-input-wrap">
              <FiUser
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="register-name"
                name="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                autoComplete="name"
                maxLength={100}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-field">
            <label htmlFor="register-email">Email Address</label>

            <div className="login-input-wrap">
              <FiMail
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="register-email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                autoComplete="email"
                maxLength={254}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-field">
            <label htmlFor="register-password">Password</label>

            <div className="login-input-wrap">
              <FiLock
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password (8+ characters)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
                disabled={loading}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-field">
            <label htmlFor="register-confirm-password">
              Confirm Password
            </label>

            <div className="login-input-wrap">
              <FiLock
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                autoComplete="new-password"
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
                disabled={loading}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <FiArrowRight className="login-submit-arrow" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="login-register-prompt">
          <span>Already have an account?</span>

          <button
            type="button"
            className="login-register-button"
            onClick={() => navigate("/login")}
            disabled={loading}
          >
            <span>Login</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="auth-trust-badge">
          <FiShield className="auth-trust-icon" aria-hidden="true" />
          <span>End-to-end encrypted workspace</span>
        </div>
      </div>
    </div>
  );
}

export default Register;