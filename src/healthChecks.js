/**
 * Health checks for Shopify, Shiprocket, and Google Sheets APIs
 */

import { getShopifyConfig } from "./shopify.js";
import { getShiprocketConfig, shiprocketGet } from "./shiprocket.js";
import { getSheetId, initializeSheetsApi } from "./sheets.js";
import axios from "axios";

/**
 * Checks if Shopify API is accessible
 * @returns {Promise<{status: boolean, message: string}>}
 */
export async function checkShopifyHealth() {
  try {
    const { domain, token } = getShopifyConfig();

    const response = await axios.head(
      `https://${domain}/admin/api/2024-10/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
        },
        timeout: 5000,
      },
    );

    if (response.status === 200) {
      console.log("[Health] Shopify API is healthy");
      return { status: true, message: "Connected" };
    }
  } catch (error) {
    console.error("[Health] Shopify API check failed:", error.message);

    if (error.response?.status === 401) {
      return { status: false, message: "Invalid token" };
    } else if (error.response?.status === 404) {
      return { status: false, message: "Invalid domain" };
    } else if (error.code === "ECONNREFUSED") {
      return { status: false, message: "Connection refused" };
    } else if (error.code === "ETIMEDOUT") {
      return { status: false, message: "Request timeout" };
    }
  }

  return { status: false, message: "Unknown error" };
}

/**
 * Checks if Shiprocket API is accessible
 * @returns {Promise<{status: boolean, message: string}>}
 */
export async function checkShiprocketHealth() {
  try {
    getShiprocketConfig(); // Validate env vars exist

    // Try to get orders to verify auth works (orders endpoint is reliable for health checks)
    const response = await shiprocketGet("/v1/external/orders", {
      limit: 1,
    });

    if (response !== undefined) {
      console.log("[Health] Shiprocket API is healthy");
      return { status: true, message: "Connected" };
    }

    console.log("[Health] Shiprocket API response was undefined");
    return { status: false, message: "Empty response" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Health] Shiprocket API check failed:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (
      errorMessage.includes("401") ||
      errorMessage.includes("Unauthorized")
    ) {
      return { status: false, message: "Invalid credentials" };
    } else if (errorMessage.includes("timeout")) {
      return { status: false, message: "Request timeout" };
    } else if (errorMessage.includes("ENOTFOUND")) {
      return { status: false, message: "Network error" };
    } else if (errorMessage.includes("HTTP")) {
      return { status: false, message: "API error" };
    }
  }

  return { status: false, message: "Unknown error" };
}

/**
 * Checks if Google Sheets API is accessible
 * @returns {Promise<{status: boolean, message: string}>}
 */
export async function checkGoogleSheetsHealth() {
  try {
    const sheetId = getSheetId();
    const sheetsApi = initializeSheetsApi();

    const response = await sheetsApi.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: "spreadsheetId,properties.title",
    });

    if (response.data && response.data.spreadsheetId) {
      console.log("[Health] Google Sheets API is healthy");
      return { status: true, message: "Connected" };
    }
  } catch (error) {
    console.error("[Health] Google Sheets API check failed:", error.message);

    if (error.message.includes("404") || error.message.includes("not found")) {
      return { status: false, message: "Sheet not found" };
    } else if (
      error.message.includes("403") ||
      error.message.includes("Forbidden")
    ) {
      return { status: false, message: "Permission denied" };
    } else if (error.message.includes("401")) {
      return { status: false, message: "Invalid credentials" };
    } else if (error.message.includes("timeout")) {
      return { status: false, message: "Request timeout" };
    }
  }

  return { status: false, message: "Unknown error" };
}

/**
 * Runs all health checks in parallel
 * @returns {Promise<object>} Object with status for each API
 */
export async function runAllHealthChecks() {
  console.log("[Health] Running all health checks...");

  const [shopify, shiprocket, sheets] = await Promise.all([
    checkShopifyHealth().catch((e) => ({ status: false, message: e.message })),
    checkShiprocketHealth().catch((e) => ({
      status: false,
      message: e.message,
    })),
    checkGoogleSheetsHealth().catch((e) => ({
      status: false,
      message: e.message,
    })),
  ]);

  const result = {
    timestamp: new Date().toISOString(),
    shopify,
    shiprocket,
    sheets,
    allHealthy: shopify.status && shiprocket.status && sheets.status,
  };

  console.log("[Health] Health check results:", result);
  return result;
}
