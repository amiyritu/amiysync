import axios from "axios";

// In-memory token cache (lost on function restart, which is expected for serverless)
let cachedToken = null;

const shiprocketBaseApi = axios.create({
  baseURL: "https://apiv2.shiprocket.in",
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
    const response = await shiprocketBaseApi.post("/v1/external/auth/login", {
      email,
      password,
    });

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
    console.error(
      "[Shiprocket] Login error response (first 500 chars):",
      typeof error.response?.data === "string"
        ? error.response.data.substring(0, 500)
        : JSON.stringify(error.response?.data).substring(0, 500),
    );
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
    const response = await shiprocketBaseApi.get(path, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("[Shiprocket] Token expired, re-logging in...");
      cachedToken = null;
      token = await login();

      try {
        const response = await shiprocketBaseApi.get(path, {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
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
      if (typeof error.response.data === 'object' && error.response.data?.message) {
        message = error.response.data.message;
      } else if (typeof error.response.data === 'string') {
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
 * Fetches all settlement batches and their orders from Shiprocket
 * Maps each order to a row format for Shiprocket_Settlements sheet
 * @returns {Promise<Array>} Array of settlement order rows
 */
export async function getRemittanceData() {
  const settlements = [];

  try {
    console.log("[Shiprocket] Fetching settlement batches...");
    const batchesResponse = await shiprocketGet("/v1/external/settlements");

    const batches = batchesResponse.data || [];
    console.log(`[Shiprocket] Found ${batches.length} settlement batches`);

    for (const batch of batches) {
      try {
        console.log(`[Shiprocket] Fetching orders for batch ${batch.id}...`);
        const ordersResponse = await shiprocketGet(
          `/v1/external/settlements/${batch.id}`,
        );

        const orders = ordersResponse.data || [];
        console.log(
          `[Shiprocket] Batch ${batch.id} has ${orders.length} orders`,
        );

        // Map each order to the Shiprocket_Settlements row format
        orders.forEach((order) => {
          const row = [
            order.order_id, // order_id
            order.awb || "", // awb
            parseFloat(order.order_amount) || 0, // order_amount
            parseFloat(order.shipping_charges) || 0, // shipping_fee
            parseFloat(order.cod_charges) || 0, // cod_fee
            parseFloat(order.adjustments) || 0, // adjustments
            parseFloat(order.rto_reversal) || 0, // rto_reversal
            parseFloat(order.net_settlement) || 0, // net_remitted
            batch.date || "", // remittance_date
            batch.id, // crf_id
          ];
          settlements.push(row);
        });
      } catch (batchError) {
        console.error(
          `[Shiprocket] Error fetching batch ${batch.id}:`,
          batchError.message,
        );
        // Continue with next batch instead of failing entirely
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
