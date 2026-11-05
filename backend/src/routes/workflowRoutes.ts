import express from "express";
import mongoose from "mongoose";
import Workflow from "../models/Workflow.js";
import Execution from "../models/Execution.js";
import { runSaga } from "../services/sagaEngine.js";
import {
  tenantAuth,
  type TenantRequest,
} from "../middleware/tenantAuth.js";

const router = express.Router();

// Read tenant ID from the authenticated request.
function getTenantId(
  req: express.Request,
  res: express.Response
): string | null {
  const tenantId = (req as TenantRequest).tenantId;

  if (!tenantId) {
    res.status(401).json({
      message: "Authenticated tenant was not found.",
    });
    return null;
  }

  return tenantId;
}

// Public test route for checking workflow API connectivity.
router.get("/test", (_req, res) => {
  res.json({
    message: "Workflow routes are working!",
  });
});

// Protect all remaining workflow routes.
router.use(tenantAuth);

// Get total workflow count for this tenant.
router.get("/stats/count", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  try {
    const count = await Workflow.countDocuments({ tenantId });

    res.json({
      totalWorkflows: count,
    });
  } catch (error) {
    console.error("Failed to count workflows:", error);

    res.status(500).json({
      message: "Failed to count workflows",
    });
  }
});

// Create a workflow.
router.post("/", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  try {
    const workflow = await Workflow.create({
      ...req.body,
      tenantId,
    });

    res.status(201).json(workflow);
  } catch (error) {
    console.error("Failed to create workflow:", error);

    res.status(400).json({
      message: "Failed to create workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get all workflows for this tenant.
router.get("/", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  try {
    const workflows = await Workflow.find({ tenantId }).sort({
      updatedAt: -1,
    });

    res.json(workflows);
  } catch (error) {
    console.error("Failed to fetch workflows:", error);

    res.status(500).json({
      message: "Failed to fetch workflows",
    });
  }
});

// Get all executions for this tenant.
router.get("/executions", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  try {
    const executions = await Execution.find({ tenantId }).sort({
      createdAt: -1,
    });

    res.json({
      totalExecutions: executions.length,
      executions,
    });
  } catch (error) {
    console.error("Failed to fetch execution history:", error);

    res.status(500).json({
      message: "Failed to fetch execution history",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Run a workflow through the Saga Engine.
router.post("/:id/run", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  const workflowId = req.params.id;

  if (!mongoose.isValidObjectId(workflowId)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  let execution: InstanceType<typeof Execution> | null = null;

  try {
    // Find workflow belonging to the authenticated tenant.
    const workflow = await Workflow.findOne({
      _id: workflowId,
      tenantId,
    });

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    // Read workflow nodes and edges.
    const nodes = Array.isArray(workflow.nodes)
      ? (workflow.nodes as import("../services/sagaEngine.js").WorkflowNode[])
      : [];

    const edges = Array.isArray(workflow.edges)
      ? (workflow.edges as import("../services/sagaEngine.js").WorkflowEdge[])
      : [];

    // Validate workflow before execution.
    if (nodes.length < 2) {
      res.status(400).json({
        message: "A workflow must contain at least two nodes to run.",
      });
      return;
    }

    // Create execution record.
    execution = await Execution.create({
      tenantId,
      workflowId: workflow._id,
      workflowName: workflow.name,
      status: "running",
      startedAt: new Date(),
      steps: [],
    });

    // Execute workflow using Saga Engine.
   const result = await runSaga(nodes, edges, {
  maxRetries: 2,
  retryDelayMs: 250,
  taskHandler: async ({ node }) => {
    const action = String(node.data?.action ?? "log");

    if (action !== "log") {
      throw new Error(
        `Unsupported task action "${action}" in task "${node.title}".`
      );
    }

    const message = String(
      node.data?.message ?? node.description
    ).trim();

    if (!message) {
      throw new Error(
        `Task "${node.title}" has no message to log.`
      );
    }

    console.log(`[FlowPilot Task: ${node.title}] ${message}`);

    return {
      action: "log",
      task: node.title,
      message,
      loggedAt: new Date().toISOString(),
    };
  },
});

    // Store execution step results.
    execution.steps = result.steps.map((step) => ({
      nodeId: step.nodeId,
      name: step.name,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      output: step.output,
      error: step.error,
    }));

    // Store final execution status.
    execution.status = result.status;
    execution.completedAt = result.completedAt;

    if (result.error) {
      execution.error = result.error;
    }

    await execution.save();

    res.status(200).json({
      message:
        result.status === "completed"
          ? "Workflow execution completed successfully."
          : "Workflow execution failed.",
      execution,
    });
  } catch (error) {
    // Log the actual error to help identify test failures.
    console.error("Workflow execution test error:", error);

    // Save failed execution details if an execution was created.
    if (execution) {
      execution.status = "failed";
      execution.completedAt = new Date();
      execution.error =
        error instanceof Error
          ? error.message
          : "Unknown execution error.";

      try {
        await execution.save();
      } catch (saveError) {
        console.error(
          "Failed to save workflow execution failure:",
          saveError
        );
      }
    }

    res.status(500).json({
      message: "Failed to run workflow.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get execution history for one workflow.
router.get("/:id/executions", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  const workflowId = req.params.id;

  if (!mongoose.isValidObjectId(workflowId)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      tenantId,
    });

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    const executions = await Execution.find({
      workflowId: workflow._id,
      tenantId,
    }).sort({
      createdAt: -1,
    });

    res.json({
      workflowId: workflow._id.toString(),
      workflowName: workflow.name,
      totalExecutions: executions.length,
      executions,
    });
  } catch (error) {
    console.error("Failed to fetch workflow execution history:", error);

    res.status(500).json({
      message: "Failed to fetch execution history",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get one execution by ID.
router.get("/executions/:executionId", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  const executionId = req.params.executionId;

  if (!mongoose.isValidObjectId(executionId)) {
    res.status(400).json({
      message: "Invalid execution ID",
    });
    return;
  }

  try {
    const execution = await Execution.findOne({
      _id: executionId,
      tenantId,
    });

    if (!execution) {
      res.status(404).json({
        message: "Execution not found",
      });
      return;
    }

    res.json(execution);
  } catch (error) {
    console.error("Failed to fetch execution:", error);

    res.status(500).json({
      message: "Failed to fetch execution",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get one workflow by ID.
router.get("/:id", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  const workflowId = req.params.id;

  if (!mongoose.isValidObjectId(workflowId)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      tenantId,
    });

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    res.json(workflow);
  } catch (error) {
    console.error("Failed to fetch workflow:", error);

    res.status(500).json({
      message: "Failed to fetch workflow",
    });
  }
});

// Update a workflow by ID.
router.put("/:id", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  const workflowId = req.params.id;

  if (!mongoose.isValidObjectId(workflowId)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const updateData = { ...req.body };

    // Prevent clients from changing tenant ownership.
    delete updateData.tenantId;
    delete updateData._id;

    const workflow = await Workflow.findOneAndUpdate(
      {
        _id: workflowId,
        tenantId,
      },
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    res.json(workflow);
  } catch (error) {
    console.error("Failed to update workflow:", error);

    res.status(400).json({
      message: "Failed to update workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Delete a workflow by ID.
router.delete("/:id", async (req, res) => {
  const tenantId = getTenantId(req, res);
  if (!tenantId) return;

  const workflowId = req.params.id;

  if (!mongoose.isValidObjectId(workflowId)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findOneAndDelete({
      _id: workflowId,
      tenantId,
    });

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    res.json({
      message: "Workflow deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete workflow:", error);

    res.status(500).json({
      message: "Failed to delete workflow",
    });
  }
});

export default router;