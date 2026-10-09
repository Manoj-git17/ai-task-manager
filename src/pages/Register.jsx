import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaUser, FaEnvelope, FaLock } from "react-icons/fa";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      // Use the deployed backend URL when available
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      setSuccess("Account created successfully!");

      // Redirect to login after 1 second
      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (error) {
      console.log(error);
      setError("Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🚀 Create Account</h1>
          <p>Join AI Task Manager and organize your tasks.</p>
        </div>

        {error && <p className="form-error">{error}</p>}

        {success && (
          <p
            style={{
              color: "green",
              textAlign: "center",
              marginBottom: "15px",
            }}
          >
            {success}
          </p>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* NAME */}
          <div className="form-field">
            <label>Name</label>

            <div className="login-input-wrap">
              <FaUser className="login-input-icon" />

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
              />
            </div>
          </div>

          {/* EMAIL */}
          <div className="form-field">
            <label>Email</label>

            <div className="login-input-wrap">
              <FaEnvelope className="login-input-icon" />

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className="form-field">
            <label>Password</label>

            <div className="login-input-wrap">
              <FaLock className="login-input-icon" />

              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "20px",
          }}
        >
          Already have an account?{" "}
          <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;