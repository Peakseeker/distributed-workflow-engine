
import mongoose, { Schema, Document } from "mongoose";

export interface IWorkflow extends Document {
  tenantId: string;
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
  status: "draft" | "active" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new Schema<IWorkflow>(
  {
      tenantId: {
      type: String,
      required: true,
      default: () => process.env.WORKFLOW_TENANT_ID || "local-tenant",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    nodes: {
      type: [Schema.Types.Mixed],
      default: () => [],
    },
    edges: {
      type: [Schema.Types.Mixed],
      default: () => [],
    },
    status: {
      type: String,
      enum: ["draft", "active", "completed", "failed"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

const Workflow = mongoose.model<IWorkflow>(
  "Workflow",
  WorkflowSchema
);

export default Workflow;
