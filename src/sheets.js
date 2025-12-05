import { google } from "googleapis";

let sheetsApi = null;

export function initializeSheetsApi() {
  if (sheetsApi) {
    return sheetsApi;
  }

  const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (
    !GOOGLE_SHEETS_ID ||
    !GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    throw new Error(
      "Missing GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variables",
    );
  }

  // Normalize the private key by replacing escaped newlines with actual newlines
  const normalizedPrivateKey = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(
    /\\n/g,
    "\n",
  );

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID || "reconciliation-project",
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || "key-id",
      private_key: normalizedPrivateKey,
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID || "client-id",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsApi = google.sheets({ version: "v4", auth });
  return sheetsApi;
}

export function getSheetId() {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) {
    throw new Error("Missing GOOGLE_SHEETS_ID environment variable");
  }
  return id;
}

/**
 * Clears data in a sheet range (preserves headers, clears from row 2 onwards)
 * @param {string} range - Range in A1 notation (e.g., 'Shopify_Orders!A2:H')
 * @returns {Promise<void>}
 */
export async function clearSheetData(range) {
  try {
    const api = initializeSheetsApi();
    const sheetId = getSheetId();

    console.log(`[Sheets] Clearing ${range}...`);
    await api.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range,
    });
    console.log(`[Sheets] Cleared ${range}`);
  } catch (error) {
    console.error(`[Sheets] Error clearing ${range}:`, error.message);
    throw new Error(`Failed to clear sheet data: ${error.message}`);
  }
}

/**
 * Writes data to a Google Sheet
 * Appends data starting from the specified range
 * @param {string} range - Range in A1 notation (e.g., 'Shopify_Orders!A2')
 * @param {Array<Array>} values - 2D array of values to write
 * @returns {Promise<void>}
 */
export async function writeToSheet(range, values) {
  if (!values || values.length === 0) {
    console.log(`[Sheets] No values to write for ${range}`);
    return;
  }

  try {
    const api = initializeSheetsApi();
    const sheetId = getSheetId();

    console.log(`[Sheets] Writing ${values.length} rows to ${range}...`);
    await api.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });
    console.log(
      `[Sheets] Successfully wrote ${values.length} rows to ${range}`,
    );
  } catch (error) {
    console.error(`[Sheets] Error writing to ${range}:`, error.message);
    throw new Error(`Failed to write to sheet: ${error.message}`);
  }
}

/**
 * Clears and writes data to a sheet tab in one operation
 * Useful for reconciliation runs where we want fresh data
 * @param {string} tabName - Tab name (e.g., 'Shopify_Orders')
 * @param {Array<Array>} values - 2D array of values to write
 * @returns {Promise<void>}
 */
export async function clearAndWriteSheet(tabName, values) {
  const clearRange = `${tabName}!A2:Z`;
  const writeRange = `${tabName}!A2`;

  try {
    await clearSheetData(clearRange);
    await writeToSheet(writeRange, values);
  } catch (error) {
    console.error(
      `[Sheets] Error in clearAndWriteSheet for ${tabName}:`,
      error.message,
    );
    throw error;
  }
}
