
import type { Request, Response, NextFunction } from "express";

export interface TenantRequest extends Request {
  tenantId?: string;
}

export function tenantAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.header("x-api-key");

  const configuredApiKey = process.env.WORKFLOW_API_KEY;
  const configuredTenantId = process.env.WORKFLOW_TENANT_ID;

  if (!configuredApiKey || !configuredTenantId) {
    res.status(503).json({
      message: "Tenant authentication is not configured.",
    });
    return;
  }

  if (!apiKey || apiKey !== configuredApiKey) {
    res.status(401).json({
      message: "Invalid or missing API key.",
    });
    return;
  }

  (req as TenantRequest).tenantId = configuredTenantId;
  next();
}
