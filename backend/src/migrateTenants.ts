import dotenv from "dotenv";
import mongoose from "mongoose";
import Workflow from "./models/Workflow.js";
import Execution from "./models/Execution.js";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/workflow_engine";

const TENANT_ID = process.env.WORKFLOW_TENANT_ID || "local-tenant";

async function migrateTenants() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected.");

    const workflows = await Workflow.updateMany(
      {
        $or: [
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: "" },
        ],
      },
      { $set: { tenantId: TENANT_ID } }
    );

    console.log("Workflows updated:", workflows.modifiedCount);

    const executions = await Execution.updateMany(
      {
        $or: [
          { tenantId: { $exists: false } },
          { tenantId: null },
          { tenantId: "" },
        ],
      },
      { $set: { tenantId: TENANT_ID } }
    );

    console.log("Executions updated:", executions.modifiedCount);
    console.log("Tenant migration completed.");
  } catch (error) {
    console.error("Tenant migration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

migrateTenants();