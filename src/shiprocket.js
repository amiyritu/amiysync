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
 * Fetches remittance/settlement data from Shiprocket
 * Tries multiple endpoints to find financial data
 * @returns {Promise<Array>} Array of settlement rows
 */
export async function getRemittanceData() {
  const settlements = [];

  try {
    console.log("[Shiprocket] Fetching remittance/settlement data...");

    let remittances = [];
    let endpoint = "";

    // Try to fetch from remittance endpoint first
    try {
      console.log("[Shiprocket] Trying /v1/external/remittance endpoint...");
      const remittanceResponse = await shiprocketGet("/v1/external/remittance");
      remittances = remittanceResponse.data || remittanceResponse || [];
      endpoint = "/v1/external/remittance";
    } catch (error1) {
      console.log(
        "[Shiprocket] Remittance endpoint failed, trying settlements...",
      );
      try {
        console.log("[Shiprocket] Trying /v1/external/settlements endpoint...");
        const settlementResponse = await shiprocketGet(
          "/v1/external/settlements",
        );
        remittances = settlementResponse.data || settlementResponse || [];
        endpoint = "/v1/external/settlements";
      } catch (error2) {
        console.log(
          "[Shiprocket] Both endpoints failed, using orders fallback...",
        );
        // Fallback to orders if both fail
        const ordersResponse = await shiprocketGet("/v1/external/orders");
        remittances = ordersResponse.data || ordersResponse || [];
        endpoint = "/v1/external/orders (fallback)";
      }
    }

    // Handle paginated response
    if (remittances && remittances.results) {
      remittances = remittances.results;
    }

    console.log(
      `[Shiprocket] Using ${endpoint}, found ${remittances.length} entries`,
    );

    // Map each entry to the Shiprocket_Settlements row format
    remittances.forEach((entry) => {
      const row = [
        entry.order_id || entry.id || "", // order_id
        entry.awb || entry.tracking_number || entry.shipment_id || "", // awb
        parseFloat(entry.order_amount || entry.amount || entry.total || 0), // order_amount
        parseFloat(
          entry.shipping_charges || entry.shipping_fee || entry.shipping || 0,
        ), // shipping_fee
        parseFloat(entry.cod_charges || entry.cod_fee || entry.cod || 0), // cod_fee
        parseFloat(entry.adjustments || 0), // adjustments
        parseFloat(entry.rto_reversal || entry.rto || 0), // rto_reversal
        parseFloat(entry.net_settlement || entry.net_amount || entry.net || 0), // net_remitted
        entry.date ||
          entry.remittance_date ||
          entry.created_at ||
          new Date().toISOString().split("T")[0], // remittance_date
        entry.crf_id || entry.batch_id || "", // crf_id
      ];
      settlements.push(row);
    });

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
