import { NavLink } from "react-router-dom";
import { FaRocket, FaHome, FaUser } from "react-icons/fa";

function Navbar() {
  return (
    <nav className="navbar" aria-label="Main navigation">
      <NavLink to="/" className="navbar-brand">
        <span className="navbar-brand-icon">
          <FaRocket />
        </span>
        <span>AI Task Manager</span>
      </NavLink>

      <div className="navbar-links">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `nav-link ${isActive ? "active" : ""}`
          }
        >
          <FaHome />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/login"
          className={({ isActive }) =>
            `nav-link ${isActive ? "active" : ""}`
          }
        >
          <FaUser />
          <span>Login</span>
        </NavLink>
      </div>

      <div className="navbar-user">
        <span className="navbar-avatar">U</span>
        <span className="navbar-user-name">User</span>
      </div>
    </nav>
  );
}

export default Navbar;