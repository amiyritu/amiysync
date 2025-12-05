import { runAllHealthChecks } from "../../src/healthChecks.js";

/**
 * HTTP endpoint to check health of all three APIs
 * GET /api/health-check
 */
export default async (req, context) => {
  try {
    // Only allow GET requests
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Method not allowed. Use GET /api/health-check",
        }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log("[Health Check] Endpoint called");
    const healthStatus = await runAllHealthChecks();

    return new Response(JSON.stringify(healthStatus), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Health Check] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        status: "error",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
