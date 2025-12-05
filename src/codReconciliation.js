/**
 * COD-Specific Reconciliation Module
 * Provides detailed settlement tracking for Cash-on-Delivery orders from Shopify
 * 
 * Data Flow:
 * 1. Shopify API → COD Orders (only orders with payment_method containing "cod")
 * 2. Shiprocket API → Settlement Data for each COD order
 * 3. Match by: order name (#3272) → shiprocket channel_order_id (3272)
 * 4. Extract: net amount received, shipping charges, COD charges, adjustments
 */

/**
 * Creates detailed COD reconciliation rows showing what was received from Shiprocket
 * @param {Array<Array>} shopifyRows - Shopify orders in format:
 *   [order_id, order_name, order_date, customer_name, payment_method, order_total, financial_status, fulfillment_status, cod_prepaid]
 * @param {Array<Array>} shiprocketRows - Shiprocket settlement rows in format:
 *   [cef_id, ute, order_id, awb, order_amount, shipping_charges, cod_charges, adjustments, rto_reversal, net_settlement, remittance_date, batch_id]
 * @returns {Array<Array>} Array of COD reconciliation rows with detailed settlement data
 */
export function generateCodReconciliation(shopifyRows, shiprocketRows) {
  console.log("[COD Reconciliation] Starting COD orders reconciliation");

  // Build map of Shiprocket data by channel_order_id (Shopify order number)
  const shiprocketByChanelId = new Map();
  const shiprocketByOrderId = new Map();

  shiprocketRows.forEach((row) => {
    const channelId = String(row[0]).trim(); // channel_order_id (the Shopify order # without #)
    const orderId = String(row[2]).trim(); // shiprocket_order_id

    if (channelId) {
      shiprocketByChanelId.set(channelId, row);
    }
    if (orderId) {
      shiprocketByOrderId.set(orderId, row);
    }
  });

  console.log(
    `[COD Reconciliation] Built Shiprocket maps: ${shiprocketByChanelId.size} channel IDs, ${shiprocketByOrderId.size} order IDs`
  );

  // Filter for COD orders and match with Shiprocket data
  const codOrders = [];
  const stats = {
    totalCod: 0,
    matched: 0,
    notMatched: 0,
    totalShiprocketAmount: 0,
    totalShiprocketNetSettlement: 0,
    totalCodCharges: 0,
  };

  shopifyRows.forEach((orderRow) => {
    try {
      const orderIdString = String(orderRow[0]).trim(); // Shopify order_id
      const orderName = String(orderRow[1]).trim() || ""; // Shopify order_name (#3272)
      const orderDate = orderRow[2] || ""; // order_date
      const customerName = orderRow[3] || ""; // customer_name
      const paymentMethod = orderRow[4] || ""; // payment_method
      const shopifyTotal = parseFloat(orderRow[5]) || 0; // order_total (rupees)
      const codPrepaidStatus = orderRow[8] || "Unknown"; // cod_prepaid

      // Check if this is a COD order
      const isCod =
        codPrepaidStatus.toUpperCase() === "COD" ||
        paymentMethod.toLowerCase().includes("cod");

      if (!isCod) {
        return; // Skip non-COD orders
      }

      stats.totalCod++;

      // Try to match with Shiprocket data
      // Strategy 1: Match by order name without # (e.g., "3272" from "#3272")
      const orderNameWithoutHash = orderName
        ? orderName.replace(/^#/, "").trim()
        : "";

      let settlement = null;
      let matchMethod = "no_match";

      if (orderNameWithoutHash) {
        settlement = shiprocketByChanelId.get(orderNameWithoutHash);
        if (settlement) {
          matchMethod = "channel_order_id";
        }
      }

      // Strategy 2: Fallback to Shopify order_id
      if (!settlement && orderIdString) {
        settlement = shiprocketByOrderId.get(orderIdString);
        if (settlement) {
          matchMethod = "shiprocket_order_id";
        }
      }

      // Extract Shiprocket settlement details
      let shiprocketOrderAmount = 0;
      let shiprocketNetSettlement = 0;
      let shippingCharges = 0;
      let codCharges = 0;
      let adjustments = 0;
      let rtoReversal = 0;
      let awb = "";
      let remittanceDate = "";
      let batchId = "";

      if (settlement) {
        shiprocketOrderAmount = parseFloat(settlement[4]) || 0; // order_amount
        shippingCharges = parseFloat(settlement[5]) || 0; // shipping_charges
        codCharges = parseFloat(settlement[6]) || 0; // cod_charges
        adjustments = parseFloat(settlement[7]) || 0; // adjustments
        rtoReversal = parseFloat(settlement[8]) || 0; // rto_reversal
        shiprocketNetSettlement = parseFloat(settlement[9]) || 0; // net_settlement
        awb = settlement[3] || ""; // awb (courier tracking)
        remittanceDate = settlement[10] || ""; // remittance_date
        batchId = settlement[11] || ""; // batch_id

        stats.matched++;
        stats.totalShiprocketAmount += shiprocketOrderAmount;
        stats.totalShiprocketNetSettlement += shiprocketNetSettlement;
        stats.totalCodCharges += codCharges;
      } else {
        stats.notMatched++;
      }

      // Build detailed COD reconciliation row
      // This row shows: What Shopify said vs What Shiprocket says we got
      const codRow = [
        orderIdString, // A: Shopify Order ID
        orderName, // B: Shopify Order Number (#3272)
        orderDate, // C: Order Date
        customerName, // D: Customer Name
        shopifyTotal, // E: Shopify Order Total (what customer should pay)
        shiprocketOrderAmount, // F: Shiprocket Order Amount (what Shiprocket received)
        shiprocketNetSettlement, // G: Net Settlement (what you actually received after deductions)
        shippingCharges, // H: Shipping Charges Deducted
        codCharges, // I: COD Collection Charges (Shiprocket's fee for handling COD)
        adjustments, // J: Other Adjustments
        rtoReversal, // K: RTO (Return to Origin) Charges
        shopifyTotal - shiprocketNetSettlement, // L: Difference (Shopify Total - Net Settlement)
        awb, // M: AWB / Tracking Number
        remittanceDate, // N: When Shiprocket Settled/Remitted the amount
        batchId, // O: Shiprocket Batch/Settlement ID
        matchMethod, // P: How it was matched (channel_order_id, shiprocket_order_id, or no_match)
      ];

      codOrders.push(codRow);
    } catch (error) {
      console.error(
        `[COD Reconciliation] Error processing order ${orderRow[0]}:`,
        error.message
      );
    }
  });

  console.log(`[COD Reconciliation] Reconciliation complete`);
  console.log(`  - Total COD Orders: ${stats.totalCod}`);
  console.log(`  - Matched with Shiprocket: ${stats.matched}`);
  console.log(`  - Not Matched: ${stats.notMatched}`);
  console.log(
    `  - Total Shiprocket Amount: ₹${stats.totalShiprocketAmount.toFixed(2)}`
  );
  console.log(
    `  - Total Net Settlement: ₹${stats.totalShiprocketNetSettlement.toFixed(2)}`
  );
  console.log(
    `  - Total COD Charges Deducted: ₹${stats.totalCodCharges.toFixed(2)}`
  );

  return codOrders;
}

/**
 * Get header row for COD reconciliation sheet
 * This documents what each column means
 */
export function getCodReconciliationHeaders() {
  return [
    [
      "Shopify Order ID", // A
      "Shopify Order #", // B (e.g., #3272)
      "Order Date", // C
      "Customer Name", // D
      "Shopify Order Total (₹)", // E - What customer was supposed to pay
      "Shiprocket Order Amount (₹)", // F - What Shiprocket says it received
      "Net Settlement (₹)", // G - What you actually got after deductions
      "Shipping Charges (₹)", // H - Deduction for shipping
      "COD Charges (₹)", // I - Shiprocket's fee for collecting COD
      "Adjustments (₹)", // J - Any other deductions/adjustments
      "RTO Reversal (₹)", // K - Reverse shipping cost if item returned
      "Difference (₹)", // L - Shopify Total - Net Settlement (should be close to 0 for COD)
      "AWB / Tracking #", // M - Courier tracking number
      "Remittance Date", // N - When settlement was processed
      "Batch ID", // O - Shiprocket settlement batch reference
      "Match Method", // P - How order was matched with Shiprocket data
    ],
  ];
}
