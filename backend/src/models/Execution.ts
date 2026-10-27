
import mongoose, { Schema, Document } from "mongoose";

export interface IExecutionStep {
  nodeId: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: unknown;
}

export interface IExecution extends Document {
  tenantId: string;
  workflowId: mongoose.Types.ObjectId;
  workflowName: string;
  status: "pending" | "running" | "completed" | "failed";
  steps: IExecutionStep[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExecutionStepSchema = new Schema<IExecutionStep>(
  {
    nodeId: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },
    startedAt: Date,
    completedAt: Date,
    error: String,
    output: Schema.Types.Mixed,
  },
  { _id: false }
);

const ExecutionSchema = new Schema<IExecution>(
  {
      tenantId: {
      type: String,
      required: true,
      default: () => process.env.WORKFLOW_TENANT_ID || "local-tenant",
      index: true,
    },
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },
    workflowName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true,
    },
    steps: {
      type: [ExecutionStepSchema],
      default: () => [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    error: String,
  },
  { timestamps: true }
);

ExecutionSchema.index({ workflowId: 1, createdAt: -1 });

const Execution = mongoose.model<IExecution>(
  "Execution",
  ExecutionSchema
);

export default Execution;
