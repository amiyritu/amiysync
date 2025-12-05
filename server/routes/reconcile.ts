import { RequestHandler } from "express";
import { runReconciliation } from "../../src/reconcileRunner.js";

export const handleReconcile: RequestHandler = async (req, res) => {
  const timeoutMs = 28000; // 28 seconds timeout
  const startTime = Date.now();

  // Set timeout for the entire request
  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        status: "error",
        message: "Reconciliation timeout: operation took too long",
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
      });
    }
  }, timeoutMs);

  try {
    console.log("[HTTP] Received reconciliation request");
    const summary = await runReconciliation();

    clearTimeout(timeoutHandle);
    res.status(200).json(summary);
  } catch (error) {
    clearTimeout(timeoutHandle);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    console.error(
      `[HTTP] Reconciliation error after ${duration}ms:`,
      errorMessage,
    );

    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        message: errorMessage,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      });
    }
  }
};
