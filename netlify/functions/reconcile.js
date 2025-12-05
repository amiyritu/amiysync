import { runReconciliation } from "../../src/reconcileRunner.js";

/**
 * HTTP endpoint to manually trigger reconciliation
 * GET /api/reconcile
 *
 * NOTE: This endpoint has a 30-second timeout limit on Netlify.
 * For long-running reconciliations, consider using the scheduled function instead.
 */
export default async (req, context) => {
  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Method not allowed. Use GET /api/reconcile",
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const timeoutMs = 28000; // 28 seconds (leaving 2 seconds buffer for Netlify)
  const startTime = Date.now();

  try {
    console.log("[HTTP] Received reconciliation request");

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Reconciliation timeout: function took too long"));
      }, timeoutMs);
    });

    // Race between the reconciliation and the timeout
    const summary = await Promise.race([
      runReconciliation(),
      timeoutPromise,
    ]);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[HTTP] Reconciliation error after ${duration}ms:`,
      error.message,
    );

    // Determine appropriate status code
    let statusCode = 500;
    if (error.message.includes("timeout")) {
      statusCode = 408; // Request Timeout
    }

    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
