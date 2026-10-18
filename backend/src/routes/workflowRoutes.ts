
import express from "express";
import mongoose from "mongoose";
import Workflow from "../models/Workflow.js";

const router = express.Router();

// Test workflow routes
router.get("/test", (_req, res) => {
  res.json({
    message: "Workflow routes are working!",
  });
});
// Run a workflow
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

    const execution = {
      executionId: new mongoose.Types.ObjectId().toString(),
      workflowId: workflow._id.toString(),
      workflowName: workflow.name,
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      steps: nodes.map((node: any, index: number) => ({
        step: index + 1,
        nodeId: node.id,
        name: node.title ?? node.name ?? `Step ${index + 1}`,
        status: "completed",
      })),
    };

    res.status(200).json({
      message: "Workflow execution completed",
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
