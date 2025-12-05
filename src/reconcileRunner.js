import { getAllShopifyOrders } from "./shopify.js";
import { getRemittanceData, calculatePerOrderCuts } from "./shiprocket.js";
import { mergeDatasets } from "./merge.js";
import { clearAndWriteSheet } from "./sheets.js";

/**
 * Main reconciliation runner
 * Orchestrates fetching data from Shopify and Shiprocket,
 * merging it, and writing to Google Sheets
 * @returns {Promise<object>} Summary of the reconciliation run
 */
export async function runReconciliation() {
  const startTime = new Date();
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `[Reconciliation] Starting reconciliation run at ${startTime.toISOString()}`,
  );
  console.log(`${"=".repeat(60)}\n`);

  try {
    // Step 1: Fetch Shopify orders
    console.log("[Reconciliation] Step 1: Fetching Shopify orders...");
    const shopifyOrders = await getAllShopifyOrders();

    // Step 2: Fetch Shiprocket settlements
    console.log("[Reconciliation] Step 2: Fetching Shiprocket settlements...");
    const shiprocketSettlements = await getRemittanceData();

    // Step 3: Calculate per-order Shiprocket cuts
    console.log("[Reconciliation] Step 3: Calculating per-order Shiprocket cuts...");
    const shiprocketCuts = await calculatePerOrderCuts();

    // Step 4: Merge datasets
    console.log("[Reconciliation] Step 4: Merging datasets...");
    const reconciliationData = mergeDatasets(
      shopifyOrders,
      shiprocketSettlements,
    );

    // Step 5: Write to Google Sheets
    console.log("[Reconciliation] Step 5: Writing to Google Sheets...");
    await clearAndWriteSheet("Shopify_Orders", shopifyOrders);
    await clearAndWriteSheet("Shiprocket_Settlements", shiprocketSettlements);
    await clearAndWriteSheet("Shiprocket_Cuts", shiprocketCuts);
    await clearAndWriteSheet("Reconciliation", reconciliationData);

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // in seconds

    const summary = {
      status: "success",
      timestamp: endTime.toISOString(),
      duration: `${duration.toFixed(2)}s`,
      shopifyOrders: shopifyOrders.length,
      shiprocketRows: shiprocketSettlements.length,
      shiprocketCuts: shiprocketCuts.length,
      reconciledRows: reconciliationData.length,
    };

    console.log(`\n[Reconciliation] Run completed successfully`);
    console.log(`  - Shopify Orders: ${summary.shopifyOrders}`);
    console.log(`  - Shiprocket Settlements: ${summary.shiprocketRows}`);
    console.log(`  - Shiprocket Cuts (per-order): ${summary.shiprocketCuts}`);
    console.log(`  - Reconciliation Rows: ${summary.reconciledRows}`);
    console.log(`  - Duration: ${summary.duration}`);
    console.log(`${"=".repeat(60)}\n`);

    return summary;
  } catch (error) {
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    const summary = {
      status: "error",
      timestamp: endTime.toISOString(),
      duration: `${duration.toFixed(2)}s`,
      error: error.message,
    };

    console.error(`\n[Reconciliation] Run failed with error:`);
    console.error(`  - Message: ${error.message}`);
    console.error(`  - Duration: ${summary.duration}`);
    console.error(`${"=".repeat(60)}\n`);

    throw error;
  }
}
