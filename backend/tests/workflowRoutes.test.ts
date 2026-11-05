import "dotenv/config";

import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import Workflow from "../src/models/Workflow.js";
import Execution from "../src/models/Execution.js";

const testApiKey = "test-workflow-api-key";
const testTenantId = "test-tenant";

const originalWorkflowTenants = process.env.WORKFLOW_TENANTS;

beforeAll(async () => {
  process.env.WORKFLOW_TENANTS = JSON.stringify({
    [testTenantId]: testApiKey,
  });

  const mongoUri =
    process.env.TEST_MONGODB_URI ||
    process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "Neither TEST_MONGODB_URI nor MONGODB_URI is configured.",
    );
  }

  await mongoose.connect(mongoUri);
});

beforeEach(async () => {
  await Workflow.deleteMany({});
  await Execution.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();

  if (originalWorkflowTenants === undefined) {
    delete process.env.WORKFLOW_TENANTS;
  } else {
    process.env.WORKFLOW_TENANTS = originalWorkflowTenants;
  }
});

async function createTestWorkflow(
  overrides: Record<string, unknown> = {},
) {
  return Workflow.create({
    name: "Test Workflow",
    description: "Workflow created for API testing",
    tenantId: testTenantId,
    nodes: [
      {
        id: "start",
        type: "Start",
        title: "Start",
        description: "Start workflow",
      },
      {
        id: "task-1",
        type: "Task",
        title: "Test Task",
        description: "Perform a test task",
      },
      {
        id: "end",
        type: "End",
        title: "End",
        description: "End workflow",
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "start",
        target: "task-1",
      },
      {
        id: "edge-2",
        source: "task-1",
        target: "end",
      },
    ],
    ...overrides,
  });
}

describe("Workflow API routes", () => {
  // Multi-tenant security tests

  it("should reject requests with a missing API key", async () => {
    const response = await request(app).get("/api/workflows");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "Invalid or missing API key.",
    );
  });

  it("should reject requests with an invalid API key", async () => {
    const response = await request(app)
      .get("/api/workflows")
      .set("x-api-key", "invalid-api-key");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "Invalid or missing API key.",
    );
  });

  it("should prevent one tenant from accessing another tenant's workflow", async () => {
    const tenantBWorkflow = await createTestWorkflow({
      tenantId: "tenant-b",
      name: "Tenant B Private Workflow",
    });

    const response = await request(app)
      .get(`/api/workflows/${tenantBWorkflow._id}`)
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Workflow not found");
  });

  // Existing workflow API tests

  it("should create a workflow", async () => {
    const response = await request(app)
      .post("/api/workflows")
      .set("x-api-key", testApiKey)
      .send({
        name: "New Workflow",
        description: "Created through API",
        nodes: [],
        edges: [],
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("New Workflow");
    expect(response.body.tenantId).toBe(testTenantId);
  });

  it("should get all workflows", async () => {
    const createdWorkflow = await createTestWorkflow();

    const savedWorkflow = await Workflow.findById(
      createdWorkflow._id,
    );

    expect(savedWorkflow).not.toBeNull();
    expect(savedWorkflow?.tenantId).toBe(testTenantId);

    const response = await request(app)
      .get("/api/workflows")
      .set("x-api-key", testApiKey);

    console.log(
      "Get all workflows response:",
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].tenantId).toBe(testTenantId);
  });

  it("should get workflow count", async () => {
    await createTestWorkflow();

    const response = await request(app)
      .get("/api/workflows/stats/count")
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(200);
    expect(response.body.totalWorkflows).toBe(1);
  });

  it("should get a workflow by ID", async () => {
    const workflow = await createTestWorkflow();

    const response = await request(app)
      .get(`/api/workflows/${workflow._id}`)
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(workflow._id.toString());
  });

  it("should update a workflow", async () => {
    const workflow = await createTestWorkflow();

    const response = await request(app)
      .put(`/api/workflows/${workflow._id}`)
      .set("x-api-key", testApiKey)
      .send({
        name: "Updated Workflow",
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Updated Workflow");
    expect(response.body.tenantId).toBe(testTenantId);
  });

  it("should delete a workflow", async () => {
    const workflow = await createTestWorkflow();

    const response = await request(app)
      .delete(`/api/workflows/${workflow._id}`)
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "Workflow deleted successfully",
    );

    const deletedWorkflow = await Workflow.findById(
      workflow._id,
    );

    expect(deletedWorkflow).toBeNull();
  });

  it("should return 404 for a workflow that does not exist", async () => {
    const nonExistingId = new mongoose.Types.ObjectId();

    const response = await request(app)
      .get(`/api/workflows/${nonExistingId}`)
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Workflow not found");
  });

  it("should return 400 for an invalid workflow ID", async () => {
    const response = await request(app)
      .get("/api/workflows/invalid-id")
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid workflow ID");
  });

  it("should run a valid workflow successfully", async () => {
    const workflow = await createTestWorkflow();

    const response = await request(app)
      .post(`/api/workflows/${workflow._id}/run`)
      .set("x-api-key", testApiKey);

    console.log(
      "Workflow run response:",
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "Workflow execution completed successfully.",
    );
    expect(response.body.execution).toBeDefined();
    expect(response.body.execution.status).toBe("completed");
  });

  it("should return 400 when running a workflow with an invalid ID", async () => {
    const response = await request(app)
      .post("/api/workflows/invalid-id/run")
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid workflow ID");
  });

  it("should get workflow execution history", async () => {
    const workflow = await createTestWorkflow();

    await Execution.create({
      tenantId: testTenantId,
      workflowId: workflow._id,
      workflowName: workflow.name,
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
      steps: [],
    });

    const response = await request(app)
      .get(`/api/workflows/${workflow._id}/executions`)
      .set("x-api-key", testApiKey);

    expect(response.status).toBe(200);
    expect(response.body.workflowId).toBe(
      workflow._id.toString(),
    );
    expect(response.body.totalExecutions).toBe(1);
  });
});