import { RequestHandler } from "express";
import { getAllShopifyOrders } from "../../src/shopify.js";
import { getRemittanceData } from "../../src/shiprocket.js";

export const handleDiagnostic: RequestHandler = async (req, res) => {
  try {
    console.log("[Diagnostic] Starting diagnostic data check...");

    // Fetch small samples
    console.log("[Diagnostic] Fetching sample Shopify orders...");
    const shopifyOrders = await getAllShopifyOrders();
    const shopifySample = shopifyOrders.slice(0, 3);

    console.log("[Diagnostic] Fetching sample Shiprocket settlements...");
    const shiprocketSettlements = await getRemittanceData();
    const shiprocketSample = shiprocketSettlements.slice(0, 3);

    // Log detailed structure
    console.log("[Diagnostic] Shopify sample structure:");
    shopifySample.forEach((row, idx) => {
      console.log(
        `  Order ${idx}: ID=${row[0]}, Name=${row[1]}, COD=${row[8]}`,
      );
    });

    console.log("[Diagnostic] Shiprocket sample structure:");
    shiprocketSample.forEach((row, idx) => {
      console.log(
        `  Settlement ${idx}: ChannelID=${row[0]}, UTE=${row[1]}, OrderID=${row[2]}, Net=${row[9]}, Freight=${row[12]}`,
      );
    });

    res.status(200).json({
      status: "success",
      shopifyCount: shopifyOrders.length,
      shiprocketCount: shiprocketSettlements.length,
      shopifySample: shopifySample.map((row) => ({
        id: row[0],
        name: row[1],
        date: row[2],
        customer: row[3],
        payment_method: row[4],
        total: row[5],
        financial_status: row[6],
        fulfillment_status: row[7],
        cod_prepaid: row[8],
      })),
      shiprocketSample: shiprocketSample.map((row) => ({
        channel_order_id: row[0],
        ute: row[1],
        order_id: row[2],
        awb: row[3],
        order_amount: row[4],
        shipping_charges: row[5],
        cod_charges: row[6],
        adjustments: row[7],
        rto_reversal: row[8],
        net_settlement: row[9],
        remittance_date: row[10],
        batch_id: row[11],
        total_freight_charge: row[12],
      })),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Diagnostic] Error:", errorMessage);
    res.status(500).json({
      status: "error",
      message: errorMessage,
    });
  }
};
