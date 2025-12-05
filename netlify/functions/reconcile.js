import { runReconciliation } from '../../src/reconcileRunner.js';

/**
 * HTTP endpoint to manually trigger reconciliation
 * GET /api/reconcile
 */
export default async (req, context) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Method not allowed. Use GET /api/reconcile',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    console.log('[HTTP] Received reconciliation request');
    const summary = await runReconciliation();

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[HTTP] Reconciliation error:', error.message);

    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
