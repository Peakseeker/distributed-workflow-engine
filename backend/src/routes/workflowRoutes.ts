
import express from "express";
import Workflow from "../models/Workflow.js";

const router = express.Router();

// Test route
router.get("/test", (_req, res) => {
  res.json({
    message: "Workflow routes are working!",
  });
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

// Get one workflow
router.get("/:id", async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    res.json(workflow);
  } catch {
    res.status(400).json({ message: "Invalid workflow ID" });
  }
});

// Update a workflow
router.put("/:id", async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
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

// Delete a workflow
router.delete("/:id", async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndDelete(req.params.id);

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    res.json({ message: "Workflow deleted successfully" });
  } catch {
    res.status(400).json({ message: "Invalid workflow ID" });
  }
});

export default router;
