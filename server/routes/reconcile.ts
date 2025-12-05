import { RequestHandler } from "express";
import { runReconciliation } from "../../src/reconcileRunner.js";

export const handleReconcile: RequestHandler = async (req, res) => {
  try {
    console.log("[HTTP] Received reconciliation request");
    const summary = await runReconciliation();

    res.status(200).json(summary);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[HTTP] Reconciliation error:", errorMessage);

    res.status(500).json({
      status: "error",
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};
