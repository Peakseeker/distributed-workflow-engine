
import express from "express";
import mongoose from "mongoose";
import Workflow from "../models/Workflow.js";
import Execution from "../models/Execution.js";
import { runSaga } from "../services/sagaEngine.js";

const router = express.Router();

// Read tenant ID after environment variables have been loaded.
function getTenantId(res: express.Response): string | null {
  const tenantId = process.env.WORKFLOW_TENANT_ID;

  if (!tenantId) {
    res.status(503).json({
      message: "Tenant configuration is missing.",
    });
    return null;
  }

  return tenantId;
}

// Test workflow routes
router.get("/test", (_req, res) => {
  res.json({
    message: "Workflow routes are working!",
  });
});

// Get total workflow count for this tenant
router.get("/stats/count", async (_req, res) => {
  const tenantId = getTenantId(res);
  if (!tenantId) return;

  try {
    const count = await Workflow.countDocuments({ tenantId });

    res.json({
      totalWorkflows: count,
    });
  } catch {
    res.status(500).json({
      message: "Failed to count workflows",
    });
  }
});

// Create a workflow
router.post("/", async (req, res) => {
  const tenantId = getTenantId(res);
  if (!tenantId) return;

  try {
    const workflow = await Workflow.create({
      ...req.body,
      tenantId,
    });

    res.status(201).json(workflow);
  } catch (error) {
    res.status(400).json({
      message: "Failed to create workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get all workflows for this tenant
router.get("/", async (_req, res) => {
  const tenantId = getTenantId(res);
  if (!tenantId) return;

  try {
    const workflows = await Workflow.find({ tenantId }).sort({
      updatedAt: -1,
    });

    res.json(workflows);
  } catch {
    res.status(500).json({
      message: "Failed to fetch workflows",
    });
  }
});

// Get all executions for this tenant
router.get("/executions", async (_req, res) => {
  const tenantId = getTenantId(res);
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
    res.status(500).json({
      message: "Failed to fetch execution history",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Run a workflow through the Saga Engine
router.post("/:id/run", async (req, res) => {
  const tenantId = getTenantId(res);
  if (!tenantId) return;

  const workflowId = req.params.id;

  if (!mongoose.isValidObjectId(workflowId)) {
    res.status(400).json({ message: "Invalid workflow ID" });
    return;
  }

  let execution: InstanceType<typeof Execution> | null = null;

  try {
    const workflow = await Workflow.findOne({
      _id: workflowId,
      tenantId,
    });

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    const nodes = Array.isArray(workflow.nodes)
      ? (workflow.nodes as import("../services/sagaEngine.js").WorkflowNode[])
      : [];

    const edges = Array.isArray(workflow.edges)
      ? (workflow.edges as import("../services/sagaEngine.js").WorkflowEdge[])
      : [];

    if (nodes.length < 2) {
      res.status(400).json({
        message: "A workflow must contain at least two nodes to run.",
      });
      return;
    }

    execution = await Execution.create({
      tenantId,
      workflowId: workflow._id,
      workflowName: workflow.name,
      status: "running",
      startedAt: new Date(),
      steps: [],
    });

    const result = await runSaga(nodes, edges, {
      maxRetries: 2,
      retryDelayMs: 250,
    });

    execution.steps = result.steps.map((step) => ({
      nodeId: step.nodeId,
      name: step.name,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      output: step.output,
      error: step.error,
    }));

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
          saveError,
        );
      }
    }

    res.status(500).json({
      message: "Failed to run workflow.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get execution history for one workflow
router.get("/:id/executions", async (req, res) => {
  const tenantId = getTenantId(res);
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
    }).sort({ createdAt: -1 });

    res.json({
      workflowId: workflow._id.toString(),
      workflowName: workflow.name,
      totalExecutions: executions.length,
      executions,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch execution history",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get one execution by ID
router.get("/executions/:executionId", async (req, res) => {
  const tenantId = getTenantId(res);
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
    res.status(500).json({
      message: "Failed to fetch execution",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get one workflow by ID
router.get("/:id", async (req, res) => {
  const tenantId = getTenantId(res);
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
  } catch {
    res.status(500).json({
      message: "Failed to fetch workflow",
    });
  }
});

// Update a workflow by ID
router.put("/:id", async (req, res) => {
  const tenantId = getTenantId(res);
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
      },
    );

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    res.json(workflow);
  } catch (error) {
    res.status(400).json({
      message: "Failed to update workflow",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Delete a workflow by ID
router.delete("/:id", async (req, res) => {
  const tenantId = getTenantId(res);
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
  } catch {
    res.status(500).json({
      message: "Failed to delete workflow",
    });
  }
});

export default router;
