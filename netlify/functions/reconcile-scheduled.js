import { runReconciliation } from "../../src/reconcileRunner.js";

// Scheduled function that runs every 6 hours
// Cron schedule: 0 */6 * * * (every 6 hours at minute 0)

export const config = {
  schedule: "0 */6 * * *",
};

export default async (req, context) => {
  try {
    console.log("[Scheduled] Reconciliation scheduled run triggered");
    const summary = await runReconciliation();

    console.log("[Scheduled] Scheduled run completed:", summary);
    return { statusCode: 200, body: JSON.stringify(summary) };
  } catch (error) {
    console.error("[Scheduled] Reconciliation error:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
