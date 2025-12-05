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
  status: "success" | "error";
  timestamp: string;
  duration?: string;
  shopifyOrders?: number;
  shiprocketRows?: number;
  reconciledRows?: number;
  error?: string;
}

/**
 * Response type for paginated Shopify endpoint (/api/reconcile/shopify?page=X)
 */
export interface PaginatedShopifyResponse {
  status: "success" | "error";
  items: any[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  timestamp: string;
  message?: string;
}

/**
 * Response type for paginated Shiprocket endpoint (/api/reconcile/shiprocket?page=X)
 */
export interface PaginatedShiprocketResponse {
  status: "success" | "error";
  items: any[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  timestamp: string;
  message?: string;
}

/**
 * Response type for merge and write endpoint (/api/reconcile/complete)
 */
export interface CompleteReconciliationResponse {
  status: "success" | "error";
  timestamp: string;
  duration?: string;
  shopifyOrders?: number;
  shiprocketRows?: number;
  reconciledRows?: number;
  message?: string;
}
