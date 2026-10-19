
import express from "express";
import mongoose from "mongoose";
import Workflow from "../models/Workflow.js";
import Execution from "../models/Execution.js";

const router = express.Router();

// Test workflow routes
router.get("/test", (_req, res) => {
  res.json({
    message: "Workflow routes are working!",
  });
});

// Get total workflow count
router.get("/stats/count", async (_req, res) => {
  try {
    const count = await Workflow.countDocuments();

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
  try {
    const workflow = await Workflow.create(req.body);

    res.status(201).json(workflow);
  } catch (error) {
    res.status(400).json({
      message: "Failed to create workflow",
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get all workflows
router.get("/", async (_req, res) => {
  try {
    const workflows = await Workflow.find();

    res.json(workflows);
  } catch {
    res.status(500).json({
      message: "Failed to fetch workflows",
    });
  }
});

// Run a workflow and save execution history
router.post("/:id/run", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    const nodes = Array.isArray(workflow.nodes)
      ? workflow.nodes
      : [];

    if (nodes.length < 2) {
      res.status(400).json({
        message: "A workflow must contain at least two nodes to run",
      });
      return;
    }

    const startedAt = new Date();

    const execution = await Execution.create({
      workflowId: workflow._id,
      workflowName: workflow.name,
      status: "running",
      startedAt,
      steps: nodes.map((node: any, index: number) => ({
        nodeId: String(node.id ?? `node-${index + 1}`),
        name: String(
          node.title ??
            node.name ??
            node.data?.label ??
            `Step ${index + 1}`
        ),
        status: "pending",
      })),
    });

    const stepStartTime = new Date();

    execution.steps.forEach((step) => {
      step.status = "completed";
      step.startedAt = stepStartTime;
      step.completedAt = new Date();
    });

    execution.status = "completed";
    execution.completedAt = new Date();

    await execution.save();

    res.status(200).json({
      message: "Workflow execution completed and saved",
      execution,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to run workflow",
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get execution history for one workflow
router.get("/:id/executions", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
      res.status(404).json({
        message: "Workflow not found",
      });
      return;
    }

    const executions = await Execution.find({
      workflowId: workflow._id,
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
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get one execution by ID
router.get("/executions/:executionId", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.executionId)) {
    res.status(400).json({
      message: "Invalid execution ID",
    });
    return;
  }

  try {
    const execution = await Execution.findById(
      req.params.executionId
    );

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
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get one workflow by ID
router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findById(req.params.id);

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
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findByIdAndUpdate(
      req.params.id,
      req.body,
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
    res.status(400).json({
      message: "Failed to update workflow",
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Delete a workflow by ID
router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({
      message: "Invalid workflow ID",
    });
    return;
  }

  try {
    const workflow = await Workflow.findByIdAndDelete(req.params.id);

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
