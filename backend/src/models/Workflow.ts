
import mongoose, { Schema, Document } from "mongoose";

export interface IWorkflow extends Document {
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
