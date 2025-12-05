/**
 * Determines the reconciliation status based on order type and settlement match
 * @param {boolean} isCod - Whether the order is COD
 * @param {boolean} hasSettlement - Whether there's a settlement record
 * @param {number} difference - Difference between Shopify total and Shiprocket net
 * @returns {string} Reconciliation status
 */
function determineStatus(isCod, hasSettlement, difference) {
  if (!isCod) {
    return "Prepaid - No Remittance";
  }

  if (!hasSettlement) {
    return "Pending Remittance";
  }

  // For COD orders with settlements, check if amounts match (tolerance: $0.50)
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

  console.log(
    `[Merge] Built Shiprocket settlement maps:`,
  );
  console.log(
    `  - CEF IDs: ${shiprocketMapByCefId.size}`,
  );
  console.log(
    `  - Order IDs: ${shiprocketMapByOrderId.size}`,
  );
  console.log(
    `  - UTEs: ${shiprocketMapByUte.size}`,
  );
  console.log(
    `[Merge] Matching strategy: CEF_ID → Order_ID → UTE → no match`,
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

      // Look up settlement data using dual-key matching with fallback logic
      let settlement = null;
      let matchMethod = "none";

      // Strategy 1: Try to match by order_name (most reliable for human-readable matching)
      if (orderName) {
        settlement = shiprocketMapByName.get(orderName);
        if (settlement) {
          matchMethod = "name";
        }
      }

      // Strategy 2: Fall back to order_id matching if name didn't work
      if (!settlement && orderIdString) {
        settlement = shiprocketMapById.get(orderIdString);
        if (settlement) {
          matchMethod = "id";
        }
      }

      // Track matching statistics
      if (matchMethod === "name") {
        stats.matchedByName++;
      } else if (matchMethod === "id") {
        stats.matchedById++;
      } else {
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

      if (settlement) {
        shiprocketNet = parseFloat(settlement[7]) || 0; // net_settlement (column 7)
        awb = settlement[1] || ""; // awb (column 1)
        shippingCharges = parseFloat(settlement[3]) || 0; // shipping_charges (column 3)
        codCharges = parseFloat(settlement[4]) || 0; // cod_charges (column 4)
        adjustments = parseFloat(settlement[5]) || 0; // adjustments (column 5)
        rtoReversal = parseFloat(settlement[6]) || 0; // rto_reversal (column 6)
        remittanceDate = settlement[8] || ""; // remittance_date (column 8)
        batchId = settlement[9] || ""; // batch_id (column 9)
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

      // Build detailed reconciliation row with both ID and name for clarity
      const reconciliationRow = [
        orderIdString, // order_id
        orderName, // order_name (human-readable)
        orderDate, // order_date
        shopifyTotal, // shopify_order_total
        shiprocketNet, // shiprocket_net_received
        difference, // difference (Shopify - Shiprocket)
        codPrepaidStatus, // cod_prepaid
        status, // status
        matchMethod, // match_method (id, name, or none)
        awb, // awb
        shippingCharges, // shipping_charges
        codCharges, // cod_charges
        adjustments, // adjustments
        rtoReversal, // rto_reversal
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

  console.log(`[Merge] Reconciliation complete: ${reconciliation.length} rows generated`);
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
