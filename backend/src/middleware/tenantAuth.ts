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
  const tenantsConfig = process.env.WORKFLOW_TENANTS;

  if (!tenantsConfig) {
    res.status(503).json({
      message: "Tenant authentication is not configured.",
    });
    return;
  }

  let tenants: Record<string, string>;

  try {
    tenants = JSON.parse(tenantsConfig) as Record<string, string>;
  } catch {
    res.status(503).json({
      message: "Tenant authentication configuration is invalid.",
    });
    return;
  }

  if (!apiKey) {
    res.status(401).json({
      message: "Invalid or missing API key.",
    });
    return;
  }

  const tenantEntry = Object.entries(tenants).find(
    ([, configuredApiKey]) => configuredApiKey === apiKey
  );

  if (!tenantEntry) {
    res.status(401).json({
      message: "Invalid or missing API key.",
    });
    return;
  }

  const [tenantId] = tenantEntry;

  (req as TenantRequest).tenantId = tenantId;
  next();
}