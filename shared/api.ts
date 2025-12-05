/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Response type for reconciliation endpoint (/api/reconcile)
 */
export interface ReconciliationResponse {
  status: 'success' | 'error';
  timestamp: string;
  duration?: string;
  shopifyOrders?: number;
  shiprocketRows?: number;
  reconciledRows?: number;
  error?: string;
}
