import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleHealthCheck } from "./routes/health-check";
import { handleReconcile } from "./routes/reconcile";
import { handleShopifyPaginated } from "./routes/shopify-paginated";
import { handleShiprocketPaginated } from "./routes/shiprocket-paginated";
import { handleComplete } from "./routes/complete";
import { handleDiagnostic } from "./routes/diagnostic";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/status", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
    });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/health-check", handleHealthCheck);
  app.get("/api/reconcile", handleReconcile);

  // Paginated reconciliation endpoints
  app.get("/api/reconcile/shopify", handleShopifyPaginated);
  app.get("/api/reconcile/shiprocket", handleShiprocketPaginated);
  app.post("/api/reconcile/complete", handleComplete);

  return app;
}
