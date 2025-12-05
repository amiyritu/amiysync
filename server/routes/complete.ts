import { RequestHandler } from "express";
import { getAllShopifyOrders } from "../../src/shopify.js";
import { getRemittanceData } from "../../src/shiprocket.js";
import { mergeDatasets } from "../../src/merge.js";
import { clearAndWriteSheet } from "../../src/sheets.js";

export const handleComplete: RequestHandler = async (req, res) => {
  const timeoutMs = 24000; // 24 seconds, well under Netlify's 26 second limit
  const startTime = Date.now();

  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        status: "error",
        message: "Reconciliation completion timeout: operation took too long",
        timestamp: new Date().toISOString(),
      });
    }
  }, timeoutMs);

  try {
    console.log("[Complete] Starting full reconciliation and write process");

    // Step 1: Fetch Shopify orders
    console.log("[Complete] Step 1: Fetching Shopify orders...");
    const shopifyOrders = await getAllShopifyOrders();

    // Step 2: Fetch Shiprocket settlements
    console.log("[Complete] Step 2: Fetching Shiprocket settlements...");
    const shiprocketSettlements = await getRemittanceData();

    // Step 3: Merge datasets
    console.log("[Complete] Step 3: Merging datasets...");
    const reconciliationData = mergeDatasets(
      shopifyOrders,
      shiprocketSettlements,
    );

    // Step 4: Write to Google Sheets
    console.log("[Complete] Step 4: Writing to Google Sheets...");
    await clearAndWriteSheet("Shopify_Orders", shopifyOrders);
    await clearAndWriteSheet("Shiprocket_Settlements", shiprocketSettlements);
    await clearAndWriteSheet("Reconciliation", reconciliationData);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime) / 1000;

    const summary = {
      status: "success",
      timestamp: endTime.toISOString(),
      duration: `${duration.toFixed(2)}s`,
      shopifyOrders: shopifyOrders.length,
      shiprocketRows: shiprocketSettlements.length,
      reconciledRows: reconciliationData.length,
    };

    console.log(`[Complete] Reconciliation completed successfully`);
    console.log(`  - Shopify Orders: ${summary.shopifyOrders}`);
    console.log(`  - Shiprocket Settlements: ${summary.shiprocketRows}`);
    console.log(`  - Reconciliation Rows: ${summary.reconciledRows}`);
    console.log(`  - Duration: ${summary.duration}`);

    clearTimeout(timeoutHandle);
    res.status(200).json(summary);
  } catch (error) {
    clearTimeout(timeoutHandle);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = (Date.now() - startTime) / 1000;

    console.error(
      `[Complete] Reconciliation error after ${duration.toFixed(2)}s:`,
      errorMessage,
    );

    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        message: errorMessage,
        timestamp: new Date().toISOString(),
        duration: `${duration.toFixed(2)}s`,
      });
    }
  }
};
