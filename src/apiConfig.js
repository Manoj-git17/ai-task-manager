/**
 * TaskFlow API Base URL Configuration
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
export default API_URL;
