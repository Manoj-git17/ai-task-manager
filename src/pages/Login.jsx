import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaLock,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaArrowRight,
  FaTasks,
} from "react-icons/fa";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const API_URL = (
    import.meta.env.VITE_API_URL || "http://localhost:5000/api"
  ).replace(/\/+$/, "");

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

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

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
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand-icon" aria-hidden="true">
            <FaTasks />
          </div>

          <h1>Welcome Back!</h1>
          <p>Log in to your TaskFlow workspace.</p>
        </div>

        {error && (
          <div className="form-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="login-email">Email Address</label>

            <div className="login-input-wrap">
              <FaEnvelope
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
              <FaLock
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
                {showPassword ? <FaEyeSlash /> : <FaEye />}
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
                Logging in...
              </>
            ) : (
              <>
                Login to TaskFlow
                <FaArrowRight aria-hidden="true" />
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
            Create account <span aria-hidden="true">→</span>
          </button>
        </div>

        <p className="login-footer">
          Your productivity journey starts here.
        </p>
      </div>
    </div>
  );
}

export default Login;