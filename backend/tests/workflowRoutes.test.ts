import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";

import mongoose from "mongoose";
import request from "supertest";

import app from "../src/app";
import Workflow from "../src/models/Workflow";
import Execution from "../src/models/Execution";

import {
  connectTestDatabase,
  disconnectTestDatabase,
} from "./setup";

describe("Workflow API routes", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await Workflow.deleteMany({});
    await Execution.deleteMany({});
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  const validWorkflow = {
    name: "Test Workflow",
    description: "Workflow created for API testing",

    nodes: [
      {
        id: "start-1",
        type: "Start",
        title: "Start",
        description: "",
        data: { label: "Start" },
      },
      {
        id: "task-1",
        type: "Task",
        title: "Create Order",
        description: "Create a test order",
        data: { label: "Create Order" },
      },
      {
        id: "end-1",
        type: "End",
        title: "End",
        description: "",
        data: { label: "End" },
      },
    ],

    edges: [
      {
        id: "edge-1",
        source: "start-1",
        target: "task-1",
      },
      {
        id: "edge-2",
        source: "task-1",
        target: "end-1",
      },
    ],
  };

  it("should create a workflow", async () => {
    const response = await request(app)
      .post("/api/workflows")
      .send(validWorkflow);

    expect(response.status).toBe(201);
    expect(response.body._id).toBeDefined();
    expect(response.body.name).toBe("Test Workflow");
  });

  it("should get all workflows", async () => {
    await Workflow.create(validWorkflow);

    const response = await request(app).get("/api/workflows");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Test Workflow");
  });

  it("should get workflow count", async () => {
    await Workflow.create(validWorkflow);

    const response = await request(app).get(
      "/api/workflows/stats/count",
    );

    expect(response.status).toBe(200);
    expect(response.body.totalWorkflows).toBe(1);
  });

  it("should get a workflow by ID", async () => {
    const workflow = await Workflow.create(validWorkflow);

    const response = await request(app).get(
      `/api/workflows/${workflow._id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(workflow._id.toString());
    expect(response.body.name).toBe("Test Workflow");
  });

  it("should update a workflow", async () => {
    const workflow = await Workflow.create(validWorkflow);

    const response = await request(app)
      .put(`/api/workflows/${workflow._id}`)
      .send({
        name: "Updated Workflow",
      });

    expect(response.status).toBe(200);
    expect(response.body._id).toBe(workflow._id.toString());
    expect(response.body.name).toBe("Updated Workflow");
  });

  it("should delete a workflow", async () => {
    const workflow = await Workflow.create(validWorkflow);

    const response = await request(app).delete(
      `/api/workflows/${workflow._id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "Workflow deleted successfully",
    );

    const deletedWorkflow = await Workflow.findById(workflow._id);
    expect(deletedWorkflow).toBeNull();
  });

  it("should return 404 for a workflow that does not exist", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();

    const response = await request(app).get(
      `/api/workflows/${missingId}`,
    );

    expect(response.status).toBe(404);
  });

  it("should return 400 for an invalid workflow ID", async () => {
    const response = await request(app).get(
      "/api/workflows/invalid-id",
    );

    expect(response.status).toBe(400);
  });

  it("should run a valid workflow successfully", async () => {
    const workflow = await Workflow.create(validWorkflow);

    const response = await request(app).post(
      `/api/workflows/${workflow._id}/run`,
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "Workflow execution completed successfully.",
    );
    expect(response.body.execution).toBeDefined();
    expect(response.body.execution.status).toBe("completed");
    expect(response.body.execution.steps).toHaveLength(3);
  });

  it("should return 400 when running a workflow with an invalid ID", async () => {
    const response = await request(app).post(
      "/api/workflows/invalid-id/run",
    );

    expect(response.status).toBe(400);
  });

  it("should get workflow execution history", async () => {
    const workflow = await Workflow.create(validWorkflow);

    await Execution.create({
      tenantId: process.env.WORKFLOW_TENANT_ID || "local-tenant",
      workflowId: workflow._id,
      workflowName: workflow.name,
      status: "completed",
      steps: [],
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const response = await request(app).get(
      `/api/workflows/${workflow._id}/executions`,
    );

    expect(response.status).toBe(200);
    expect(response.body.totalExecutions).toBe(1);
    expect(response.body.executions).toHaveLength(1);
  });
});