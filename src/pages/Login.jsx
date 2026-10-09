import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock, FaEnvelope } from "react-icons/fa";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      // Save login information
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Navigate to dashboard
      navigate("/");
    } catch (error) {
      console.error(error);
      setError("Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🔐 Login</h1>
          <p>Welcome back! Please login to continue.</p>
        </div>

        {error && <p className="form-error">{error}</p>}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="form-field">
            <label htmlFor="login-email">Email</label>

            <div className="login-input-wrap">
              <FaEnvelope
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="login-email"
                type="email"
                placeholder="Enter Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-field">
            <label htmlFor="login-password">Password</label>

            <div className="login-input-wrap">
              <FaLock
                className="login-input-icon"
                aria-hidden="true"
              />

              <input
                id="login-password"
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Register Link */}
        <p style={{ textAlign: "center", marginTop: "20px" }}>
          Don't have an account?{" "}
          <span
            onClick={() => navigate("/register")}
            style={{
              color: "#007bff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Create Account
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;