import { runAllHealthChecks } from '../../src/healthChecks.js';

/**
 * HTTP endpoint to check health of all three APIs
 * GET /api/health-check
 */
export default async (req, context) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Method not allowed. Use GET /api/health-check',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    console.log('[Health Check] Endpoint called');
    const healthStatus = await runAllHealthChecks();

    return new Response(JSON.stringify(healthStatus), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Health Check] Error:', error.message);

    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
