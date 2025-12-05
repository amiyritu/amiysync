import { RequestHandler } from "express";
import { getAllShopifyOrders } from "../../src/shopify.js";
import { getRemittanceData, calculatePerOrderCuts } from "../../src/shiprocket.js";
import { mergeDatasets } from "../../src/merge.js";
import { clearAndWriteSheet } from "../../src/sheets.js";

export const handleComplete: RequestHandler = async (req, res) => {
  const timeoutMs = 28000; // 28 seconds for Netlify's 30 second limit with buffer
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
    console.log(`[Complete] Fetched ${shopifyOrders.length} Shopify orders`);

    // Step 2: Fetch Shiprocket settlements
    console.log("[Complete] Step 2: Fetching Shiprocket settlements...");
    const shiprocketSettlements = await getRemittanceData();
    console.log(
      `[Complete] Fetched ${shiprocketSettlements.length} Shiprocket settlements`,
    );

    // Step 3: Merge datasets
    console.log("[Complete] Step 3: Merging datasets...");
    const reconciliationData = mergeDatasets(
      shopifyOrders,
      shiprocketSettlements,
    );
    console.log(
      `[Complete] Generated ${reconciliationData.length} reconciliation rows`,
    );

    // Step 4: Calculate per-order Shiprocket cuts (optional, won't block main reconciliation if it times out)
    let shiprocketCuts: any[] = [];
    try {
      console.log("[Complete] Step 4a: Calculating per-order Shiprocket cuts...");
      shiprocketCuts = await calculatePerOrderCuts();
      console.log(
        `[Complete] Calculated cuts for ${shiprocketCuts.length} shipments`,
      );
    } catch (cutsError) {
      const cutsErrorMsg = cutsError instanceof Error ? cutsError.message : String(cutsError);
      console.warn(
        `[Complete] Warning: Failed to calculate cuts (non-blocking): ${cutsErrorMsg}`,
      );
    }

    // Step 5: Write to Google Sheets (in parallel for speed)
    console.log("[Complete] Step 4b/5: Writing to Google Sheets...");
    const sheetsWrites = [
      clearAndWriteSheet("Shopify_Orders", shopifyOrders),
      clearAndWriteSheet("Shiprocket_Settlements", shiprocketSettlements),
      clearAndWriteSheet("Reconciliation", reconciliationData),
    ];

    if (shiprocketCuts.length > 0) {
      sheetsWrites.push(clearAndWriteSheet("Shiprocket_Cuts", shiprocketCuts));
    }

    await Promise.all(sheetsWrites);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime) / 1000;

    // Calculate reconciliation statistics
    const reconciledCount = reconciliationData.filter(
      (row) => row[8] === "Reconciled",
    ).length;
    const mismatchCount = reconciliationData.filter(
      (row) => row[8] === "Mismatch",
    ).length;
    const pendingCount = reconciliationData.filter(
      (row) => row[8] === "Pending Remittance",
    ).length;
    const prepaidCount = reconciliationData.filter(
      (row) => row[8] === "Prepaid - No Remittance",
    ).length;

    const summary = {
      status: "success",
      timestamp: endTime.toISOString(),
      duration: `${duration.toFixed(2)}s`,
      shopifyOrders: shopifyOrders.length,
      shiprocketRows: shiprocketSettlements.length,
      reconciledRows: reconciliationData.length,
      reconciliationStats: {
        reconciled: reconciledCount,
        mismatch: mismatchCount,
        pendingRemittance: pendingCount,
        prepaidNoRemittance: prepaidCount,
      },
    };

    console.log(`[Complete] Reconciliation completed successfully`);
    console.log(`  - Shopify Orders: ${summary.shopifyOrders}`);
    console.log(`  - Shiprocket Settlements: ${summary.shiprocketRows}`);
    console.log(`  - Reconciliation Rows: ${summary.reconciledRows}`);
    console.log(`  - Reconciled: ${reconciledCount}`);
    console.log(`  - Mismatches: ${mismatchCount}`);
    console.log(`  - Pending Remittance: ${pendingCount}`);
    console.log(`  - Prepaid (No Remittance): ${prepaidCount}`);
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
