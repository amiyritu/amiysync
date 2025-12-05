/**
 * Determines the reconciliation status based on order type and settlement match
 * @param {boolean} isCod - Whether the order is COD
 * @param {boolean} hasSettlement - Whether there's a settlement record
 * @param {number} difference - Difference between Shopify total and Shiprocket net
 * @returns {string} Reconciliation status
 */
function determineStatus(isCod, hasSettlement, difference) {
  // If no settlement data exists, determine status based on order type
  if (!hasSettlement) {
    return isCod ? "Pending Remittance" : "Prepaid - No Remittance";
  }

  // For orders with settlements, check if amounts match (tolerance: $0.50)
  if (Math.abs(difference) < 0.5) {
    return "Reconciled";
  }

  return "Mismatch";
}

/**
 * Merges Shopify orders with Shiprocket settlements to create detailed reconciliation rows
 * Uses dual-key matching (by CEF ID and Shopify ID) with fallback logic
 * Handles both COD and prepaid orders, with per-order settlement details
 * @param {Array<Array>} shopifyRows - Array of Shopify order rows
 *   Format: [order_id, order_name, order_date, customer_name, payment_method, order_total, financial_status, fulfillment_status, cod_prepaid]
 * @param {Array<Array>} shiprocketRows - Array of Shiprocket settlement rows
 *   Format: [cef_id, ute, order_id, awb, order_amount, shipping_charges, cod_charges, adjustments, rto_reversal, net_settlement, remittance_date, batch_id]
 * @returns {Array<Array>} Array of reconciliation rows
 */
export function mergeDatasets(shopifyRows, shiprocketRows) {
  console.log(
    `[Merge] Starting reconciliation with ${shopifyRows.length} Shopify orders and ${shiprocketRows.length} Shiprocket settlement rows`,
  );

  // Build multi-key maps of Shiprocket settlements for flexible matching
  // Key 1: By CEF_ID (Shiprocket's primary order identifier)
  const shiprocketMapByCefId = new Map();
  // Key 2: By Shopify order_id (numeric ID)
  const shiprocketMapByOrderId = new Map();
  // Key 3: By UTE (Shiprocket's secondary identifier)
  const shiprocketMapByUte = new Map();

  shiprocketRows.forEach((row) => {
    const cefId = String(row[0]).trim(); // cef_id (column 0)
    const ute = String(row[1]).trim(); // ute (column 1)
    const orderId = String(row[2]).trim(); // order_id (column 2)

    if (cefId) {
      if (shiprocketMapByCefId.has(cefId)) {
        console.log(
          `[Merge] Multiple settlements found for CEF ID ${cefId}, using most recent`,
        );
      }
      shiprocketMapByCefId.set(cefId, row);
    }

    if (orderId) {
      if (shiprocketMapByOrderId.has(orderId)) {
        console.log(
          `[Merge] Multiple settlements found for order ID ${orderId}, using most recent`,
        );
      }
      shiprocketMapByOrderId.set(orderId, row);
    }

    if (ute) {
      if (shiprocketMapByUte.has(ute)) {
        console.log(
          `[Merge] Multiple settlements found for UTE ${ute}, using most recent`,
        );
      }
      shiprocketMapByUte.set(ute, row);
    }
  });

  console.log(`[Merge] Built Shiprocket settlement maps:`);
  console.log(`  - Channel Order IDs (Shopify): ${shiprocketMapByCefId.size}`);
  console.log(`  - Shiprocket Order IDs: ${shiprocketMapByOrderId.size}`);
  console.log(`  - UTEs: ${shiprocketMapByUte.size}`);

  // Log sample Shiprocket keys for debugging
  if (shiprocketMapByCefId.size > 0) {
    const cefKeys = Array.from(shiprocketMapByCefId.keys()).slice(0, 3);
    console.log(
      `[Merge] Sample Shiprocket Channel Order IDs: ${cefKeys.join(", ")}`,
    );
  }
  if (shiprocketMapByOrderId.size > 0) {
    const orderIds = Array.from(shiprocketMapByOrderId.keys()).slice(0, 3);
    console.log(`[Merge] Sample Shiprocket Order IDs: ${orderIds.join(", ")}`);
  }

  // Log sample Shopify keys for debugging
  if (shopifyRows.length > 0) {
    console.log(
      `[Merge] Sample Shopify Order IDs: ${shopifyRows
        .slice(0, 3)
        .map((r) => r[0])
        .join(", ")}`,
    );
  }

  console.log(
    `[Merge] Matching strategy: channel_order_id (Shopify) → shiprocket_order_id → ute → no match`,
  );

  // Reconcile each Shopify order with Shiprocket data
  const reconciliation = [];
  const stats = {
    totalOrders: shopifyRows.length,
    cod: 0,
    prepaid: 0,
    reconciled: 0,
    mismatches: 0,
    pendingRemittance: 0,
    prepaidNoRemittance: 0,
    matchedByName: 0,
    matchedById: 0,
    matchedByNone: 0,
  };

  shopifyRows.forEach((orderRow) => {
    try {
      const orderIdString = String(orderRow[0]).trim(); // order_id (column 0)
      const orderName = String(orderRow[1]).trim() || ""; // order_name (column 1)
      const orderDate = orderRow[2] || ""; // order_date (column 2)
      const paymentMethod = orderRow[4] || ""; // payment_method (column 4)
      const codPrepaidStatus = orderRow[8] || "Unknown"; // cod_prepaid (column 8)
      const shopifyTotal = parseFloat(orderRow[5]) || 0; // order_total (column 5)

      // Determine if this is a COD order
      const isCod =
        codPrepaidStatus.toUpperCase() === "COD" ||
        paymentMethod.toLowerCase().includes("cod");

      if (isCod) {
        stats.cod++;
      } else {
        stats.prepaid++;
      }

      // Look up settlement data using multi-key matching with fallback logic
      let settlement = null;
      let matchMethod = "none";

      // Strategy 1: Try to match Shopify order name (#3787) against Shiprocket's channel_order_id (3787)
      // Strip the "#" prefix from Shopify order name for matching
      const orderNameWithoutHash = orderName
        ? orderName.replace(/^#/, "").trim()
        : "";
      if (orderNameWithoutHash) {
        settlement = shiprocketMapByCefId.get(orderNameWithoutHash);
        if (settlement) {
          matchMethod = "channel_order_id";
        }
      }

      // Strategy 2: Fall back to Shopify order_id matching against Shiprocket's internal order_id
      if (!settlement && orderIdString) {
        settlement = shiprocketMapByOrderId.get(orderIdString);
        if (settlement) {
          matchMethod = "shiprocket_order_id";
        }
      }

      // Strategy 3: Fall back to UTE matching if available
      if (!settlement && orderName) {
        settlement = shiprocketMapByUte.get(orderName);
        if (settlement) {
          matchMethod = "ute";
        }
      }

      // Track matching statistics
      if (matchMethod === "channel_order_id") {
        stats.matchedByName++;
      } else if (matchMethod === "shiprocket_order_id") {
        stats.matchedById++;
      } else if (matchMethod === "ute") {
        stats.matchedByNone++;
      }

      const hasSettlement = !!settlement;

      // Extract settlement details if available
      let shiprocketNet = 0;
      let awb = "";
      let shippingCharges = 0;
      let codCharges = 0;
      let adjustments = 0;
      let rtoReversal = 0;
      let remittanceDate = "";
      let batchId = "";
      let totalFreightCharge = 0;

      if (settlement) {
        shiprocketNet = parseFloat(settlement[9]) || 0; // net_settlement (column 9)
        awb = settlement[3] || ""; // awb (column 3)
        shippingCharges = parseFloat(settlement[5]) || 0; // shipping_charges (column 5)
        codCharges = parseFloat(settlement[6]) || 0; // cod_charges (column 6)
        adjustments = parseFloat(settlement[7]) || 0; // adjustments (column 7)
        rtoReversal = parseFloat(settlement[8]) || 0; // rto_reversal (column 8)
        remittanceDate = settlement[10] || ""; // remittance_date (column 10)
        batchId = settlement[11] || ""; // batch_id (column 11)
        totalFreightCharge = parseFloat(settlement[12]) || 0; // total_freight_charge (column 12)
      }

      const difference = shopifyTotal - shiprocketNet;
      const status = determineStatus(isCod, hasSettlement, difference);

      // Track statistics
      if (status === "Reconciled") {
        stats.reconciled++;
      } else if (status === "Mismatch") {
        stats.mismatches++;
      } else if (status === "Pending Remittance") {
        stats.pendingRemittance++;
      } else if (status === "Prepaid - No Remittance") {
        stats.prepaidNoRemittance++;
      }

      // Build detailed reconciliation row with all matching keys and settlement details
      const reconciliationRow = [
        orderIdString, // order_id (Shopify)
        orderName, // order_name (Shopify - human-readable)
        orderDate, // order_date
        shopifyTotal, // shopify_order_total
        shiprocketNet, // shiprocket_net_received
        difference, // difference (Shopify - Shiprocket)
        codPrepaidStatus, // cod_prepaid
        status, // status (Reconciled, Mismatch, Pending, Prepaid)
        matchMethod, // match_method (cef_id, order_id, ute, or none)
        awb, // awb
        shippingCharges, // shipping_charges
        codCharges, // cod_charges
        adjustments, // adjustments
        rtoReversal, // rto_reversal
        totalFreightCharge, // total_freight_charge
        remittanceDate, // remittance_date
        batchId, // batch_id
        "", // notes (empty for manual entry)
      ];

      reconciliation.push(reconciliationRow);
    } catch (error) {
      console.error(
        `[Merge] Error processing order ${orderRow[0]}:`,
        error.message,
      );
    }
  });

  console.log(
    `[Merge] Reconciliation complete: ${reconciliation.length} rows generated`,
  );
  console.log("[Merge] Summary Statistics:");
  console.log(`  - Total Orders: ${stats.totalOrders}`);
  console.log(`  - COD Orders: ${stats.cod}`);
  console.log(`  - Prepaid Orders: ${stats.prepaid}`);
  console.log(`  - Reconciled (COD): ${stats.reconciled}`);
  console.log(`  - Mismatches (COD): ${stats.mismatches}`);
  console.log(`  - Pending Remittance (COD): ${stats.pendingRemittance}`);
  console.log(`  - Prepaid - No Remittance: ${stats.prepaidNoRemittance}`);
  console.log("[Merge] Matching Strategy Results:");
  console.log(`  - Matched by Name: ${stats.matchedByName}`);
  console.log(`  - Matched by ID: ${stats.matchedById}`);
  console.log(`  - Not Matched: ${stats.matchedByNone}`);

  return reconciliation;
}
