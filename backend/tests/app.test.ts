import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Backend API routes", () => {
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
});