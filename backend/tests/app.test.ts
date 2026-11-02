import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import {
  connectTestDatabase,
  disconnectTestDatabase,
} from "./setup";

describe("Backend API routes", () => {
  const originalTenants = process.env.WORKFLOW_TENANTS;

  const tenantAKey = "test-tenant-a-key";
  const tenantBKey = "test-tenant-b-key";

  beforeAll(async () => {
    process.env.WORKFLOW_TENANTS = JSON.stringify({
      "tenant-a": tenantAKey,
      "tenant-b": tenantBKey,
    });

    await connectTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();

    if (originalTenants === undefined) {
      delete process.env.WORKFLOW_TENANTS;
    } else {
      process.env.WORKFLOW_TENANTS = originalTenants;
    }
  });

  it("GET / should return API running message", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
  });

  it("GET /api/health should return health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
  });

  it("GET /api/workflows/test should return workflow test message", async () => {
    const response = await request(app).get("/api/workflows/test");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Workflow routes are working!");
  });

  it("should reject workflow requests without an API key", async () => {
    const response = await request(app).get("/api/workflows/stats/count");

    expect(response.status).toBe(401);
  });

  it("should reject workflow requests with an incorrect API key", async () => {
    const response = await request(app)
      .get("/api/workflows/stats/count")
      .set("x-api-key", "incorrect-api-key");

    expect(response.status).toBe(401);
  });

  it("should accept a valid tenant API key", async () => {
    const response = await request(app)
      .get("/api/workflows/stats/count")
      .set("x-api-key", tenantAKey);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("totalWorkflows");
  });

  it("should accept a different valid tenant API key", async () => {
    const response = await request(app)
      .get("/api/workflows/stats/count")
      .set("x-api-key", tenantBKey);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("totalWorkflows");
  });
});