import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import workflowRoutes from "./routes/workflowRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/workflows", workflowRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "Distributed Workflow Engine API is running!",
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    service: "Workflow Engine Backend",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

export default app;