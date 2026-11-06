/**
 * TaskFlow API Base URL Configuration & Connection Pre-Warmer
 *
 * Provides a single source of truth for the backend API base URL across the application.
 *
 * Resolution Order:
 * 1. import.meta.env.VITE_API_URL if explicitly configured (e.g., .env.production).
 * 2. In browser production environments (e.g., deployed on Render), defaults to:
 *    https://ai-task-manager-backend-glq4.onrender.com/api
 * 3. In local development on localhost/127.0.0.1, defaults to /api (proxied via Vite).
 */

export const PRODUCTION_API_URL =
  "https://ai-task-manager-backend-glq4.onrender.com/api";

export function getApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

  // If an absolute HTTP/HTTPS URL was explicitly provided, use it
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl;
  }

  // Detect deployed browser runtime on Render or non-localhost domain
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1";

    if (!isLocalhost || hostname.includes("onrender.com")) {
      return PRODUCTION_API_URL;
    }
  }

  // If explicitly configured as a relative path like /api
  if (envUrl) {
    return envUrl;
  }

  // Default for local development with Vite dev server proxy
  return "/api";
}

export const API_URL = getApiBaseUrl();

let warmupInFlight = null;

/**
 * Pre-warms the backend API to eliminate Render free-tier cold start delays.
 * Fires a lightweight health check in the background as soon as the client bundle loads.
 */
export function warmupBackend() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (warmupInFlight) return warmupInFlight;

  const healthUrl = `${API_URL}/health`;
  warmupInFlight = fetch(healthUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
    .then((res) => (res.ok ? res.json() : null))
    .catch((err) => {
      // Non-blocking warmup warning
      console.warn("Backend warmup background ping:", err.message);
      return null;
    })
    .finally(() => {
      // Clear in-flight promise after 30 seconds so subsequent keep-alives can ping
      setTimeout(() => {
        warmupInFlight = null;
      }, 30000);
    });

  return warmupInFlight;
}

// Automatically trigger background warmup when module loads in browser
if (typeof window !== "undefined") {
  setTimeout(() => {
    warmupBackend();
  }, 100);
}

export default API_URL;
