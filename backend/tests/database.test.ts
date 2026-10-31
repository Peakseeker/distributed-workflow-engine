import { describe, it, expect, afterAll } from "vitest";
import mongoose from "mongoose";
import {
  connectTestDatabase,
  disconnectTestDatabase,
} from "./setup.js";

describe("Test database connection", () => {
  it("should connect to the test database", async () => {
    await connectTestDatabase();

    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name).toBe("workflow_engine_test");
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await disconnectTestDatabase();
    }
  });
});