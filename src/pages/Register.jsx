import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaTasks,
  FaArrowRight,
} from "react-icons/fa";

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
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand-icon" aria-hidden="true">
            <FaTasks />
          </div>

          <h1>Create Account</h1>

          <p>Start organizing your tasks with TaskFlow.</p>
        </div>

        {error && (
          <div className="form-error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-field">
            <label htmlFor="register-name">Full Name</label>

            <div className="login-input-wrap">
              <FaUser
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
              <FaEnvelope
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
              <FaLock
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
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-field">
            <label htmlFor="register-confirm-password">
              Confirm Password
            </label>

            <div className="login-input-wrap">
              <FaLock
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
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
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
              "Creating account..."
            ) : (
              <>
                Create Account
                <FaArrowRight aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <p className="login-register-link">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            disabled={loading}
          >
            Login
          </button>
        </p>

        <p className="login-footer">
          Plan smarter. Achieve more.
        </p>
      </div>
    </div>
  );
}

export default Register;