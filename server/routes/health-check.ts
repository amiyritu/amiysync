import { RequestHandler } from "express";
import { runAllHealthChecks } from "../../src/healthChecks.js";

export const handleHealthCheck: RequestHandler = async (req, res) => {
  try {
    console.log("[Health Check] Endpoint called");
    const healthStatus = await runAllHealthChecks();

    res.status(200).json(healthStatus);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("[Health Check] Error:", errorMessage);

    res.status(500).json({
      status: "error",
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};
