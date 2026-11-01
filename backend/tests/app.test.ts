import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const originalApiKey = process.env.WORKFLOW_API_KEY;
const originalTenantId = process.env.WORKFLOW_TENANT_ID;

describe("Backend API routes", () => {
  beforeAll(() => {
    process.env.WORKFLOW_API_KEY = "test-api-key";
    process.env.WORKFLOW_TENANT_ID = "test-tenant";
  });

  afterAll(() => {
    process.env.WORKFLOW_API_KEY = originalApiKey;
    process.env.WORKFLOW_TENANT_ID = originalTenantId;
  });

  it("GET / should return API running message", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "Distributed Workflow Engine API is running!"
    );
  });

  it("GET /api/health should return health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("OK");
    expect(response.body.service).toBe("Workflow Engine Backend");
    expect(response.body).toHaveProperty("database");
    expect(response.body).toHaveProperty("timestamp");
  });

  it("GET /api/workflows/test should return workflow test message", async () => {
    const response = await request(app).get("/api/workflows/test");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("message");
  });

  it("should reject workflow requests without an API key", async () => {
    const response = await request(app).get("/api/workflows/stats/count");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid or missing API key.");
  });

  it("should reject workflow requests with an incorrect API key", async () => {
    const response = await request(app)
      .get("/api/workflows/stats/count")
      .set("x-api-key", "incorrect-api-key");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid or missing API key.");
  });
});