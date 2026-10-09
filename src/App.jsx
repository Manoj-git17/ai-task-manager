import { useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  const location = useLocation();

  function handleDarkModeChange(value) {
    setDarkMode(value);
    localStorage.setItem("darkMode", String(value));
  }

  return (
    <div className={darkMode ? "app dark" : "app"}>
      <Routes>
        {/* Protected dashboard */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={
              <Home
                darkMode={darkMode}
                setDarkMode={handleDarkModeChange}
              />
            }
          />
        </Route>

        {/* Login */}
        <Route
          path="/login"
          element={
            localStorage.getItem("token") ? (
              <Navigate to="/" replace />
            ) : (
              <Login key={location.pathname} />
            )
          }
        />

        {/* Registration */}
        <Route
          path="/register"
          element={
            localStorage.getItem("token") ? (
              <Navigate to="/" replace />
            ) : (
              <Register />
            )
          }
        />

        {/* Unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme={darkMode ? "dark" : "colored"}
      />
    </div>
  );
}

export default App;