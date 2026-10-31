import { describe, it, expect, vi } from "vitest";
import { runSaga } from "../src/services/sagaEngine.js";
import type {
  WorkflowNode,
  WorkflowEdge,
} from "../src/services/sagaEngine.js";

const nodes: WorkflowNode[] = [
  {
    id: "start",
    type: "Start",
    title: "Start",
    description: "",
  },
  {
    id: "task-1",
    type: "Task",
    title: "Create Order",
    description: "Create a test order",
  },
  {
    id: "end",
    type: "End",
    title: "End",
    description: "",
  },
];

const edges: WorkflowEdge[] = [
  { source: "start", target: "task-1" },
  { source: "task-1", target: "end" },
];

describe("runSaga", () => {
  it("completes a valid workflow", async () => {
    const result = await runSaga(nodes, edges);

    expect(result.status).toBe("completed");
    expect(result.steps).toHaveLength(3);

    expect(
      result.steps.every((step) => step.status === "completed"),
    ).toBe(true);
  });

  it("fails when a task has no description", async () => {
    const invalidNodes: WorkflowNode[] = nodes.map((node) =>
      node.id === "task-1"
        ? { ...node, description: "" }
        : node,
    );

    const result = await runSaga(invalidNodes, edges, {
      maxRetries: 0,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("has no description");
  });

  it("retries a failed task and succeeds when it later passes", async () => {
    let attempts = 0;

    const taskHandler = vi.fn(async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("Temporary failure");
      }

      return { success: true };
    });

    const result = await runSaga(nodes, edges, {
      maxRetries: 1,
      retryDelayMs: 0,
      taskHandler,
    });

    expect(result.status).toBe("completed");
    expect(attempts).toBe(2);
    expect(taskHandler).toHaveBeenCalledTimes(2);
  });

  it("runs compensation in reverse order after a task fails", async () => {
    const threeTaskNodes: WorkflowNode[] = [
      nodes[0],
      nodes[1],
      {
        id: "task-2",
        type: "Task",
        title: "Send Email",
        description: "Send a test email",
      },
      {
        id: "task-3",
        type: "Task",
        title: "Update Inventory",
        description: "Update test inventory",
      },
      nodes[2],
    ];

    const threeTaskEdges: WorkflowEdge[] = [
      { source: "start", target: "task-1" },
      { source: "task-1", target: "task-2" },
      { source: "task-2", target: "task-3" },
      { source: "task-3", target: "end" },
    ];

    const compensated: string[] = [];

    const result = await runSaga(
      threeTaskNodes,
      threeTaskEdges,
      {
        maxRetries: 0,

        taskHandler: async ({ node }) => {
          if (node.id === "task-3") {
            throw new Error("Task failed");
          }

          return { completed: true };
        },

        compensationHandler: async ({ node }) => {
          compensated.push(String(node.id));
        },
      },
    );

    expect(result.status).toBe("failed");
    expect(compensated).toEqual(["task-2", "task-1"]);
  });

  it("rejects a workflow with invalid incoming connections", async () => {
    const cycleNodes: WorkflowNode[] = [
      nodes[0],
      nodes[1],
      {
        id: "task-2",
        type: "Task",
        title: "Second Task",
        description: "Second test task",
      },
      nodes[2],
    ];

    const cycleEdges: WorkflowEdge[] = [
      { source: "start", target: "task-1" },
      { source: "task-1", target: "task-2" },
      { source: "task-2", target: "task-1" },
      { source: "task-2", target: "end" },
    ];

    await expect(
      runSaga(cycleNodes, cycleEdges),
    ).rejects.toThrow(
      'Node "Create Order" must have exactly one incoming connection.',
    );
  });

  it("records a compensation failure without stopping remaining compensations", async () => {
    const compensated: string[] = [];

    const result = await runSaga(
      [
        nodes[0],
        nodes[1],
        {
          id: "task-2",
          type: "Task",
          title: "Second Task",
          description: "Second test task",
        },
        nodes[2],
      ],
      [
        { source: "start", target: "task-1" },
        { source: "task-1", target: "task-2" },
        { source: "task-2", target: "end" },
      ],
      {
        maxRetries: 0,

        taskHandler: async ({ node }) => {
          if (node.id === "task-2") {
            throw new Error("Task failed");
          }

          return { completed: true };
        },

        compensationHandler: async ({ node }) => {
          compensated.push(String(node.id));

          if (node.id === "task-1") {
            throw new Error("Compensation failed");
          }
        },
      },
    );

    expect(result.status).toBe("failed");
    expect(compensated).toEqual(["task-1"]);

    expect(
      result.steps.some(
        (step) =>
          step.name === "Compensation: Create Order" &&
          step.status === "failed",
      ),
    ).toBe(true);
  });
});