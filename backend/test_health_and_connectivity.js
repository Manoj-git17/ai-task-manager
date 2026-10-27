const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { app, isOriginAllowed, allowedOrigins } = require("./server");

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

  // 7. Verify Production Frontend Origin Validation
  console.log("\n[7] Testing Production Frontend CORS Origin Whitelist...");
  const prodOrigin = "https://ai-task-manager-frontend-x3og.onrender.com";
  assert(
    allowedOrigins.includes(prodOrigin),
    `allowedOrigins must explicitly include production frontend: ${prodOrigin}`
  );
  assert(
    isOriginAllowed(prodOrigin),
    "isOriginAllowed must allow the production frontend origin"
  );
  assert(
    isOriginAllowed(`${prodOrigin}/`),
    "isOriginAllowed must allow production frontend origin with trailing slash"
  );
  assert(
    isOriginAllowed("https://ai-task-manager-frontend-preview.onrender.com"),
    "isOriginAllowed must allow Render staging/preview deployments"
  );

  // Test unauthorized origin in simulated production mode
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.strictEqual(
      isOriginAllowed("https://malicious-attacker-domain.xyz"),
      false,
      "Unauthorized origin must be rejected in production mode"
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
  console.log("✓ Production frontend origin and security isolation verified");

  // 8. Verify CORS Preflight OPTIONS Request to /api/login
  console.log("\n[8] Testing CORS Preflight (OPTIONS /api/login) from Production Origin...");
  const preflightRes = await makeRequest(app, "OPTIONS", "/api/login", {
    origin: prodOrigin,
    "access-control-request-method": "POST",
    "access-control-request-headers": "content-type,authorization",
  });
  assert(
    preflightRes.statusCode === 204 || preflightRes.statusCode === 200,
    `Preflight must return HTTP 204 or 200 (got ${preflightRes.statusCode})`
  );
  assert.strictEqual(
    preflightRes.headers["access-control-allow-origin"],
    prodOrigin,
    `Preflight response must return Access-Control-Allow-Origin: ${prodOrigin}`
  );
  assert.strictEqual(
    preflightRes.headers["access-control-allow-credentials"],
    "true",
    "Preflight must include Access-Control-Allow-Credentials: true"
  );
  assert(
    preflightRes.headers["access-control-allow-methods"]?.includes("POST"),
    "Preflight must allow POST method"
  );
  console.log("✓ CORS preflight OPTIONS request answered with correct headers and status 204/200");

  // 9. Verify OPTIONS Preflight Immunity to Rate Limiting
  console.log("\n[9] Testing OPTIONS Preflight Immunity to Rate Limiting...");
  for (let i = 0; i < 40; i++) {
    const rapidPreflight = await makeRequest(app, "OPTIONS", "/api/login", {
      origin: prodOrigin,
      "access-control-request-method": "POST",
    });
    assert(
      rapidPreflight.statusCode === 204 || rapidPreflight.statusCode === 200,
      `Preflight burst request ${i + 1} must not be rate limited (got ${rapidPreflight.statusCode})`
    );
    assert.strictEqual(
      rapidPreflight.headers["access-control-allow-origin"],
      prodOrigin
    );
  }
  console.log("✓ 40 consecutive preflight OPTIONS requests processed without rate limit rejection");

  // 10. Verify POST /api/login from Production Origin with Credentials
  console.log("\n[10] Testing POST /api/login from Production Origin (Validation Handling)...");
  const loginEmptyRes = await makeRequest(
    app,
    "POST",
    "/api/login",
    {
      origin: prodOrigin,
      "content-type": "application/json",
    },
    {}
  );
  assert.strictEqual(
    loginEmptyRes.headers["access-control-allow-origin"],
    prodOrigin,
    "POST /api/login must return Access-Control-Allow-Origin header"
  );
  assert.strictEqual(
    loginEmptyRes.headers["access-control-allow-credentials"],
    "true",
    "POST /api/login must return Access-Control-Allow-Credentials header"
  );
  assert.strictEqual(
    loginEmptyRes.statusCode,
    400,
    "Empty login body must return 400 Bad Request"
  );
  assert.strictEqual(loginEmptyRes.body.success, false);
  assert.strictEqual(
    loginEmptyRes.body.message,
    "Please enter your email and password."
  );
  console.log("✓ POST /api/login received by Express and executed validation with full CORS support");

  // 11. End-to-End Registration & Login via Production Origin with CORS
  console.log("\n[11] Testing End-to-End Auth Lifecycle from Production Origin...");
  const uniqueEmail = `probe-test-${Date.now()}@taskflow.dev`;
  const registerRes = await makeRequest(
    app,
    "POST",
    "/api/register",
    {
      origin: prodOrigin,
      "content-type": "application/json",
    },
    {
      name: "CORS Test User",
      email: uniqueEmail,
      password: "TestPassword123!",
    }
  );

  assert.strictEqual(registerRes.statusCode, 201, "Registration must succeed with HTTP 201");
  assert.strictEqual(registerRes.headers["access-control-allow-origin"], prodOrigin);
  assert.strictEqual(registerRes.headers["access-control-allow-credentials"], "true");
  assert(registerRes.body.token, "Registration must return JWT token");
  assert.strictEqual(registerRes.body.user.email, uniqueEmail);
  assert.strictEqual(registerRes.body.user.password, undefined, "User password must not be returned");

  // Test Login with valid credentials
  const loginRes = await makeRequest(
    app,
    "POST",
    "/api/login",
    {
      origin: prodOrigin,
      "content-type": "application/json",
    },
    {
      email: uniqueEmail,
      password: "TestPassword123!",
    }
  );

  assert.strictEqual(loginRes.statusCode, 200, "Valid login must return HTTP 200");
  assert.strictEqual(loginRes.headers["access-control-allow-origin"], prodOrigin);
  assert.strictEqual(loginRes.headers["access-control-allow-credentials"], "true");
  assert.strictEqual(loginRes.body.success, true);
  assert(loginRes.body.token, "Login response must contain JWT token");
  assert.strictEqual(loginRes.body.user.email, uniqueEmail);
  assert.strictEqual(loginRes.body.user.password, undefined);
  console.log("✓ End-to-end registration and login succeed with JWT and CORS headers");

  // 12. Invalid Credentials Response Handling from Production Origin
  console.log("\n[12] Testing Invalid Credentials Handling with CORS...");
  const badLoginRes = await makeRequest(
    app,
    "POST",
    "/api/login",
    {
      origin: prodOrigin,
      "content-type": "application/json",
    },
    {
      email: uniqueEmail,
      password: "WrongPassword999!",
    }
  );

  assert.strictEqual(badLoginRes.statusCode, 401, "Invalid password must return HTTP 401");
  assert.strictEqual(badLoginRes.headers["access-control-allow-origin"], prodOrigin);
  assert.strictEqual(badLoginRes.headers["access-control-allow-credentials"], "true");
  assert.strictEqual(badLoginRes.body.success, false);
  assert.strictEqual(badLoginRes.body.message, "Invalid email or password.");
  console.log("✓ Invalid credentials safely handled with HTTP 401 and CORS headers");

  console.log("\n========================================================");
  console.log("ALL BACKEND CONNECTIVITY & HEALTH REGRESSION TESTS PASSED!");
  console.log("========================================================\n");
}

runHealthAndConnectivityTests().catch((err) => {
  console.error("Health regression test failed:", err);
  process.exit(1);
});
