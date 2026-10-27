import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiLock,
  FiMail,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiShield,
  FiAlertTriangle,
} from "react-icons/fi";
import { API_URL } from "../apiConfig";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      let response;
      try {
        response = await fetch(`${API_URL}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
          }),
        });
      } catch (networkErr) {
        // Fallback only during local development if Vite dev proxy or port failed
        const isLocalhost =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1" ||
            window.location.hostname === "0.0.0.0");

        if (isLocalhost) {
          const fallbackUrl = API_URL.startsWith("http")
            ? "/api/login"
            : "http://localhost:5000/api/login";
          try {
            response = await fetch(fallbackUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: cleanEmail,
                password,
              }),
            });
          } catch {
            throw networkErr;
          }
        } else {
          throw networkErr;
        }
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          setError("Incorrect email or password. Please try again.");
        } else if (response.status === 429) {
          setError("Too many attempts. Please try again later.");
        } else if (response.status >= 500) {
          setError(
            data.message ||
              "The server is temporarily unavailable. Please try again."
          );
        } else {
          setError(data.message || "Unable to log in. Please try again.");
        }

        return;
      }

      if (!data.token || !data.user) {
        setError("Invalid response from server. Please try again.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const destination = location.state?.from?.pathname || "/";

      navigate(destination, { replace: true });
    } catch (err) {
      console.error("Login error:", err);

      setError(
        "Unable to connect to the server. Please check your connection and try again."
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
            <span>TaskFlow Intelligence</span>
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
                <linearGradient id="tfGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
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
                stroke="url(#tfGradLogin)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="24" cy="10" r="2" fill="#A78BFA" />
            </svg>
          </div>

          <h1>Welcome Back</h1>
          <p>Sign in to your TaskFlow workspace.</p>
        </div>

        {error && (
          <div className="form-error" role="alert" aria-live="polite">
            <FiAlertTriangle className="form-error-icon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="login-email">Email Address</label>

            <div className="login-input-wrap">
              <FiMail
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                autoComplete="email"
                required
                maxLength={254}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="login-password">Password</label>

            <div className="login-input-wrap">
              <FiLock
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in to TaskFlow</span>
                <FiArrowRight className="login-submit-arrow" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="login-register-prompt">
          <span>Don't have an account?</span>

          <button
            type="button"
            className="login-register-button"
            onClick={() => navigate("/register")}
          >
            <span>Create account</span>
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

export default Login;