import axios from "axios";

// In-memory token cache (lost on function restart, which is expected for serverless)
let cachedToken = null;

const shiprocketBaseApi = axios.create({
  baseURL: "https://apiv2.shiprocket.in",
  timeout: 15000, // 15 second timeout per request
});

export function getShiprocketConfig() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD environment variables",
    );
  }

  return { email, password };
}

/**
 * Logs in to Shiprocket and returns a JWT token
 * Caches the token in memory for subsequent requests
 * @returns {Promise<string>} JWT token
 */
export async function login() {
  if (cachedToken) {
    console.log("[Shiprocket] Using cached token");
    return cachedToken;
  }

  try {
    const { email, password } = getShiprocketConfig();

    console.log("[Shiprocket] Attempting login...");
    console.log(
      "[Shiprocket] Login URL will be: https://apiv2.shiprocket.in/v1/external/auth/login",
    );
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      { email, password },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate, br",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 30000,
      },
    );

    if (!response.data || !response.data.token) {
      throw new Error("Login response missing token");
    }

    cachedToken = response.data.token;
    console.log("[Shiprocket] Login successful, token cached");
    return cachedToken;
  } catch (error) {
    console.error("[Shiprocket] Login failed:", error.message);
    console.error("[Shiprocket] Login error status:", error.response?.status);
    console.error("[Shiprocket] Login error headers:", error.response?.headers);
    console.error(
      "[Shiprocket] Login error response type:",
      typeof error.response?.data,
    );

    // Only log response data if it's safe to do so
    if (error.response?.data) {
      const responsePreview =
        typeof error.response.data === "string"
          ? error.response.data.substring(0, 200)
          : JSON.stringify(error.response.data).substring(0, 200);
      console.error(
        "[Shiprocket] Login error response (first 200 chars):",
        responsePreview,
      );
    }

    throw new Error(`Shiprocket login failed: ${error.message}`);
  }
}

/**
 * Helper function to make authenticated requests to Shiprocket API
 * Automatically handles token refresh on 401
 * @param {string} path - API path (e.g., '/v1/external/settlements')
 * @param {object} params - Query parameters (optional)
 * @returns {Promise<any>} API response data
 */
export async function shiprocketGet(path, params = {}) {
  let token = await login();

  try {
    console.log(`[Shiprocket] GET ${path}`);
    const response = await axios.get(`https://apiv2.shiprocket.in${path}`, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("[Shiprocket] Token expired, re-logging in...");
      cachedToken = null;
      token = await login();

      try {
        const response = await axios.get(`https://apiv2.shiprocket.in${path}`, {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate, br",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 30000,
        });
        return response.data;
      } catch (retryError) {
        console.error("[Shiprocket] Retry failed:", retryError.message);
        console.error("[Shiprocket] Retry error details:", retryError);
        throw new Error(
          `Shiprocket API call failed after token refresh: ${retryError.message}`,
        );
      }
    } else if (error.response) {
      const status = error.response.status;
      let message = error.message;

      // Handle different response types (JSON vs HTML/text)
      if (
        typeof error.response.data === "object" &&
        error.response.data?.message
      ) {
        message = error.response.data.message;
      } else if (typeof error.response.data === "string") {
        // If response is HTML or plain text, just use the status
        message = `HTTP ${status}`;
      }

      console.error(`[Shiprocket] API error (${status}): ${message}`);
      throw new Error(`Shiprocket API error (${status}): ${message}`);
    } else {
      console.error("[Shiprocket] Network error:", error.message);
      console.error("[Shiprocket] Network error details:", error);
      throw new Error(`Shiprocket network error: ${error.message}`);
    }
  }
}

/**
 * Helper function to safely extract and parse numeric fields
 * @param {any} value - The value to parse
 * @param {number} defaultValue - Default if value is missing/invalid
 * @returns {number} Parsed float value
 */
function safeParseFloat(value, defaultValue = 0) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Helper function to safely extract string fields
 * @param {any} value - The value to extract
 * @param {string} defaultValue - Default if value is missing
 * @returns {string} String value
 */
function safeParseString(value, defaultValue = "") {
  return value ? String(value).trim() : defaultValue;
}

/**
 * Fetches detailed settlement data from a specific batch
 * @param {string} batchId - The batch/settlement ID
 * @returns {Promise<Array>} Array of order rows from the batch
 */
async function getSettlementBatchDetails(batchId) {
  const batchOrders = [];

  try {
    console.log(
      `[Shiprocket] Fetching details for settlement batch: ${batchId}`,
    );
    const response = await shiprocketGet(`/v1/external/settlements/${batchId}`);

    // Handle different response structures
    let orders = [];
    if (response.data && Array.isArray(response.data.orders)) {
      orders = response.data.orders;
    } else if (response.data && Array.isArray(response.data)) {
      orders = response.data;
    } else if (Array.isArray(response)) {
      orders = response;
    } else {
      console.warn(
        `[Shiprocket] Unexpected response structure for batch ${batchId}:`,
        typeof response,
      );
      return batchOrders;
    }

    console.log(
      `[Shiprocket] Batch ${batchId} contains ${orders.length} orders`,
    );

    // Log sample order structure for debugging
    if (orders.length > 0) {
      console.log(
        `[Shiprocket] Sample order structure (first order):`,
        JSON.stringify(orders[0], null, 2).substring(0, 500),
      );
    }

    // Extract order-level remittance data
    orders.forEach((order, index) => {
      try {
        // Primary matching key: channel_order_id (Shopify order ID from Shiprocket)
        const channelOrderId = safeParseString(
          order.channel_order_id,
          order.cef_id || order.CEF_ID || order.order_id || order.id || "",
        );

        // Secondary matching key: UTE or other identifiers
        const ute = safeParseString(
          order.ute || order.UTE || order.last_mile_awb || "",
          "",
        );

        const shippingCharges = safeParseFloat(order.shipping_charges, 0);
        const totalFreightCharge = safeParseFloat(
          order.total_freight_charge || order.shipping_charges || 0,
          shippingCharges,
        );

        const row = [
          channelOrderId, // channel_order_id / shopify_order_id (primary match key)
          ute, // ute / last_mile_awb (secondary match key)
          safeParseString(order.order_id || order.id || "", ""), // shiprocket_order_id
          safeParseString(
            order.awb ||
              order.last_mile_awb ||
              order.tracking_number ||
              order.shipment_id ||
              "",
            "",
          ), // awb
          safeParseFloat(order.order_amount || order.base_amount || 0, 0), // order_amount
          shippingCharges, // shipping_charges
          safeParseFloat(order.cod_charges, 0), // cod_charges
          safeParseFloat(order.adjustments, 0), // adjustments
          safeParseFloat(order.rto_reversal, 0), // rto_reversal
          safeParseFloat(order.net_settlement, 0), // net_settlement
          safeParseString(
            order.remittance_date ||
              order.date ||
              new Date().toISOString().split("T")[0],
            new Date().toISOString().split("T")[0],
          ), // remittance_date
          safeParseString(order.batch_id, batchId), // batch_id
          totalFreightCharge, // total_freight_charge
        ];
        batchOrders.push(row);
      } catch (orderError) {
        console.error(
          `[Shiprocket] Error processing order ${index} in batch ${batchId}:`,
          orderError.message,
        );
      }
    });

    return batchOrders;
  } catch (error) {
    console.error(
      `[Shiprocket] Error fetching batch details for ${batchId}:`,
      error.message,
    );
    throw new Error(
      `Failed to fetch settlement batch ${batchId}: ${error.message}`,
    );
  }
}

/**
 * Fetches remittance/settlement data from Shiprocket
 * Primary approach: fetches all settlement batches, then fetches detailed order data from each batch
 * Fallback: if settlements fail, tries orders endpoint with pagination limits
 * @returns {Promise<Array>} Array of settlement rows with per-order details
 */
export async function getRemittanceData() {
  const settlements = [];
  const MAX_PAGES = 5; // Limit pages to prevent timeout
  const MAX_WAIT_TIME = 20000; // 20 second limit

  try {
    console.log("[Shiprocket] Fetching remittance/settlement data...");
    console.log(
      "[Shiprocket] Strategy: Primary (settlements with order details) with pagination",
    );

    const startTime = Date.now();

    try {
      // Primary approach: Use settlements endpoint (has remittance data)
      console.log(
        "[Shiprocket] Fetching settlement batches from /v1/external/settlements...",
      );

      let batches = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 100;

      while (hasMore && page <= MAX_PAGES) {
        if (Date.now() - startTime > MAX_WAIT_TIME) {
          console.log(
            "[Shiprocket] Timeout approaching, stopping batch fetch at page " +
              page,
          );
          break;
        }

        console.log(
          `[Shiprocket] Fetching settlement batches page ${page} (size: ${pageSize})...`,
        );
        const settlementResponse = await shiprocketGet(
          "/v1/external/settlements",
          { page, per_page: pageSize },
        );

        let pageResults = [];
        if (settlementResponse.data && Array.isArray(settlementResponse.data)) {
          pageResults = settlementResponse.data;
        } else if (
          settlementResponse.data &&
          Array.isArray(settlementResponse.data.batches)
        ) {
          pageResults = settlementResponse.data.batches;
        } else if (Array.isArray(settlementResponse)) {
          pageResults = settlementResponse;
        }

        batches.push(...pageResults);
        console.log(
          `[Shiprocket] Page ${page}: fetched ${pageResults.length} batch(es) (total: ${batches.length})`,
        );

        if (pageResults.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(
        `[Shiprocket] Total settlement batches found: ${batches.length}`,
      );

      // Process batches to extract settlement orders
      for (const batch of batches) {
        if (Date.now() - startTime > MAX_WAIT_TIME) {
          console.log(
            "[Shiprocket] Timeout approaching, stopping batch detail fetch",
          );
          break;
        }

        try {
          // Most batch responses contain orders directly
          let batchOrders = [];
          if (batch.orders && Array.isArray(batch.orders)) {
            batchOrders = batch.orders;
          } else if (batch.data && Array.isArray(batch.data.orders)) {
            batchOrders = batch.data.orders;
          } else if (Array.isArray(batch)) {
            batchOrders = batch;
          }

          console.log(
            `[Shiprocket] Processing batch with ${batchOrders.length} orders`,
          );

          batchOrders.forEach((order) => {
            try {
              const channelOrderId = safeParseString(
                order.channel_order_id,
                order.cef_id ||
                  order.CEF_ID ||
                  order.order_id ||
                  order.id ||
                  "",
              );

              const ute = safeParseString(
                order.ute || order.UTE || order.last_mile_awb || "",
                "",
              );

              const shippingCharges = safeParseFloat(
                order.shipping_charges || 0,
                0,
              );
              const totalFreightCharge = safeParseFloat(
                order.total_freight_charge || order.shipping_charges || 0,
                shippingCharges,
              );

              const row = [
                channelOrderId,
                ute,
                safeParseString(order.order_id || order.id || "", ""),
                safeParseString(
                  order.awb ||
                    order.last_mile_awb ||
                    order.tracking_number ||
                    order.shipment_id ||
                    "",
                  "",
                ),
                safeParseFloat(order.order_amount || order.base_amount || 0, 0),
                shippingCharges,
                safeParseFloat(order.cod_charges || 0, 0),
                safeParseFloat(order.adjustments || 0, 0),
                safeParseFloat(order.rto_reversal || 0, 0),
                safeParseFloat(
                  order.net_settlement || order.remittance_amount || 0,
                  0,
                ),
                safeParseString(
                  order.remittance_date ||
                    order.date ||
                    new Date().toISOString().split("T")[0],
                  new Date().toISOString().split("T")[0],
                ),
                safeParseString(order.batch_id || batch.id || "", ""),
                totalFreightCharge,
              ];
              settlements.push(row);
            } catch (orderError) {
              console.error(
                `[Shiprocket] Error processing order:`,
                orderError.message,
              );
            }
          });
        } catch (batchError) {
          console.error(
            `[Shiprocket] Error processing batch:`,
            batchError.message,
          );
        }
      }

      if (settlements.length === 0) {
        throw new Error("No settlement orders found in batches");
      }
    } catch (primaryError) {
      console.log(
        "[Shiprocket] Settlement batches approach failed, attempting fallback to /v1/external/orders:",
        primaryError.message,
      );

      try {
        // Fallback: Use orders endpoint as last resort
        let orders = [];
        let page = 1;
        let hasMore = true;
        const pageSize = 100;

        while (hasMore && page <= 3) {
          if (Date.now() - startTime > MAX_WAIT_TIME) {
            console.log(
              "[Shiprocket] Timeout approaching, stopping fallback fetch at page " +
                page,
            );
            break;
          }

          console.log(`[Shiprocket] Fallback: Fetching orders page ${page}...`);
          const ordersResponse = await shiprocketGet("/v1/external/orders", {
            page,
            per_page: pageSize,
          });

          let pageResults = [];
          if (ordersResponse.data && Array.isArray(ordersResponse.data)) {
            pageResults = ordersResponse.data;
          } else if (
            ordersResponse.data &&
            Array.isArray(ordersResponse.data.results)
          ) {
            pageResults = ordersResponse.data.results;
          } else if (Array.isArray(ordersResponse)) {
            pageResults = ordersResponse;
          }

          orders.push(...pageResults);
          console.log(
            `[Shiprocket] Fallback page ${page}: fetched ${pageResults.length} orders`,
          );

          if (pageResults.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }

        orders.forEach((order) => {
          try {
            const channelOrderId = safeParseString(
              order.channel_order_id,
              order.cef_id || order.CEF_ID || order.order_id || order.id || "",
            );

            const ute = safeParseString(
              order.ute || order.UTE || order.last_mile_awb || "",
              "",
            );

            const shippingCharges = safeParseFloat(
              order.shipping_charges || order.shipping || 0,
              0,
            );
            const totalFreightCharge = safeParseFloat(
              order.total_freight_charge || order.shipping_charges || 0,
              shippingCharges,
            );

            const row = [
              channelOrderId,
              ute,
              safeParseString(order.order_id || order.id || "", ""),
              safeParseString(
                order.awb || order.last_mile_awb || order.tracking_number || "",
                "",
              ),
              safeParseFloat(
                order.order_amount || order.total || order.base_amount || 0,
                0,
              ),
              shippingCharges,
              safeParseFloat(order.cod_charges || order.cod || 0, 0),
              safeParseFloat(order.adjustments || 0, 0),
              safeParseFloat(order.rto_reversal || order.rto || 0, 0),
              safeParseFloat(order.net_settlement || order.net_amount || 0, 0),
              safeParseString(
                order.date ||
                  order.created_at ||
                  new Date().toISOString().split("T")[0],
                new Date().toISOString().split("T")[0],
              ),
              safeParseString(order.batch_id || order.crf_id || "", ""),
              totalFreightCharge,
            ];
            settlements.push(row);
          } catch (orderError) {
            console.error(
              `[Shiprocket] Error processing fallback order:`,
              orderError.message,
            );
          }
        });

        if (settlements.length === 0) {
          throw new Error("No orders found in fallback endpoint");
        }
      } catch (fallbackError) {
        console.error(
          "[Shiprocket] Fallback also failed:",
          fallbackError.message,
        );
        throw new Error(`All approaches failed: ${fallbackError.message}`);
      }
    }

    console.log(
      `[Shiprocket] Total settlement rows fetched: ${settlements.length}`,
    );
    return settlements;
  } catch (error) {
    console.error(
      "[Shiprocket] Error fetching remittance data:",
      error.message,
    );
    throw new Error(`Failed to fetch Shiprocket settlements: ${error.message}`);
  }
}
