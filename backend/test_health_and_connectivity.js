const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { app } = require("./server");

/**
 * Regression Test Suite: Backend Connectivity & Health Check Diagnostics
 * Ensures endpoints / and /api/health and /api/ai/status:
 * 1. Accept connections and respond with HTTP 200 OK
 * 2. Return consistent structured JSON payloads
 * 3. Never hang or timeout
 * 4. Are exempt from general rate limiters so monitoring probes never get blocked
 * 5. Include security headers
 */

// Helper to simulate HTTP requests through Express app without external network dependencies
function makeRequest(app, method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = "";

    const req = {
      method: method.toUpperCase(),
      url,
      path: url.split("?")[0],
      headers: {
        host: "localhost:5000",
        accept: "application/json",
        ...headers,
      },
      socket: {
        remoteAddress: "127.0.0.1",
      },
      query: {},
      body: body || {},
    };

    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return responseHeaders[name.toLowerCase()];
      },
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.headersSent = true;
        this.setHeader("content-type", "application/json");
        responseBody = JSON.stringify(data);
        resolve({
          statusCode,
          headers: responseHeaders,
          body: data,
          rawBody: responseBody,
          latencyMs: Date.now() - startTime,
        });
      },
      send(data) {
        this.headersSent = true;
        responseBody = String(data);
        resolve({
          statusCode,
          headers: responseHeaders,
          body: responseBody,
          rawBody: responseBody,
          latencyMs: Date.now() - startTime,
        });
      },
      end(data) {
        if (data) responseBody = String(data);
        this.headersSent = true;
        resolve({
          statusCode,
          headers: responseHeaders,
          body: responseBody,
          rawBody: responseBody,
          latencyMs: Date.now() - startTime,
        });
      },
    };

    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

async function runHealthAndConnectivityTests() {
  console.log("=== Running TaskFlow Backend Connectivity & Health Check Regression Tests ===");

  // 1. Root / Endpoint Test
  console.log("\n[1] Testing GET / (Root Endpoint)...");
  const rootRes = await makeRequest(app, "GET", "/");
  assert.strictEqual(rootRes.statusCode, 200, "GET / must return HTTP 200");
  assert.strictEqual(rootRes.body.success, true);
  assert(rootRes.body.message.includes("AI Task Manager API is running"));
  assert(rootRes.latencyMs < 100, `Root endpoint latency should be <100ms (got ${rootRes.latencyMs}ms)`);
  console.log(`✓ GET / returned HTTP 200 in ${rootRes.latencyMs}ms:`, rootRes.body.message);

  // 2. GET /api/health Endpoint Test
  console.log("\n[2] Testing GET /api/health (System Health Check)...");
  const healthRes = await makeRequest(app, "GET", "/api/health");
  assert.strictEqual(healthRes.statusCode, 200, "GET /api/health must return HTTP 200");
  assert.strictEqual(healthRes.body.success, true);
  assert.strictEqual(healthRes.body.message, "Backend is healthy.");
  assert(typeof healthRes.body.database === "string", "Health response must report database state");
  assert(healthRes.latencyMs < 100, `Health check latency should be <100ms (got ${healthRes.latencyMs}ms)`);
  console.log(`✓ GET /api/health returned HTTP 200 in ${healthRes.latencyMs}ms: DB state = '${healthRes.body.database}'`);

  // 3. GET /api/ai/status Endpoint Test
  console.log("\n[3] Testing GET /api/ai/status (AI Service Diagnostic Status)...");
  const aiStatusRes = await makeRequest(app, "GET", "/api/ai/status");
  assert.strictEqual(aiStatusRes.statusCode, 200, "GET /api/ai/status must return HTTP 200");
  assert.strictEqual(aiStatusRes.body.success, true);
  assert("geminiConfigured" in aiStatusRes.body, "Must include geminiConfigured flag");
  assert("model" in aiStatusRes.body, "Must include configured model name");
  assert.strictEqual(aiStatusRes.body.sdk, "@google/generative-ai", "Must reference official SDK");
  console.log(`✓ GET /api/ai/status returned HTTP 200: geminiConfigured=${aiStatusRes.body.geminiConfigured}, model=${aiStatusRes.body.model}`);

  // 4. Verify Health Check Is Not Blocked by Rate Limiting
  console.log("\n[4] Testing Health Check Rate Limiting Immunity...");
  for (let i = 0; i < 25; i++) {
    const burstRes = await makeRequest(app, "GET", "/api/health");
    assert.strictEqual(burstRes.statusCode, 200, `Burst request ${i + 1} must return 200 OK`);
  }
  console.log("✓ GET /api/health cleanly processed 25 consecutive rapid requests without rate limit rejection");

  // 5. Verify Security Headers
  console.log("\n[5] Testing HTTP Security Headers...");
  assert.strictEqual(healthRes.headers["x-content-type-options"], "nosniff");
  assert.strictEqual(healthRes.headers["x-frame-options"], "SAMEORIGIN");
  assert.strictEqual(healthRes.headers["x-xss-protection"], "1; mode=block");
  assert.strictEqual(healthRes.headers["referrer-policy"], "strict-origin-when-cross-origin");
  console.log("✓ Security headers verified on health response");

  // 6. Verify 404 Behavior for Nonexistent Endpoints
  console.log("\n[6] Testing 404 Route Handling...");
  const notFoundRes = await makeRequest(app, "GET", "/api/nonexistent-endpoint-12345");
  assert.strictEqual(notFoundRes.statusCode, 404, "Unmatched route must return HTTP 404");
  assert.strictEqual(notFoundRes.body.success, false);
  assert(notFoundRes.body.message.includes("Endpoint not found"));
  console.log("✓ 404 handler returns structured error without hanging");

  console.log("\n========================================================");
  console.log("ALL BACKEND CONNECTIVITY & HEALTH REGRESSION TESTS PASSED!");
  console.log("========================================================\n");
}

runHealthAndConnectivityTests().catch((err) => {
  console.error("Health regression test failed:", err);
  process.exit(1);
});
