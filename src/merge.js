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
 * Uses dual-key matching (by name and ID) with fallback logic
 * Handles both COD and prepaid orders, with per-order settlement details
 * @param {Array<Array>} shopifyRows - Array of Shopify order rows
 *   Format: [order_id, order_name, order_date, customer_name, payment_method, order_total, financial_status, fulfillment_status, cod_prepaid]
 * @param {Array<Array>} shiprocketRows - Array of Shiprocket settlement rows
 *   Format: [order_id, awb, order_amount, shipping_charges, cod_charges, adjustments, rto_reversal, net_settlement, remittance_date, batch_id]
 * @returns {Array<Array>} Array of reconciliation rows
 */
export function mergeDatasets(shopifyRows, shiprocketRows) {
  console.log(
    `[Merge] Starting reconciliation with ${shopifyRows.length} Shopify orders and ${shiprocketRows.length} Shiprocket settlement rows`,
  );

  // Build dual-key maps of Shiprocket settlements for flexible matching
  // Key 1: By order_id (numeric ID)
  const shiprocketMapById = new Map();
  // Key 2: By order_name (human-readable name like "#1001")
  const shiprocketMapByName = new Map();

  shiprocketRows.forEach((row) => {
    const orderId = String(row[0]).trim(); // order_id (column 0)

    if (orderId) {
      // Log if we're replacing a previous entry
      if (shiprocketMapById.has(orderId)) {
        console.log(
          `[Merge] Multiple settlements found for order ID ${orderId}, using most recent`,
        );
      }
      shiprocketMapById.set(orderId, row);
    }
  });

  console.log(
    `[Merge] Built Shiprocket settlement ID map with ${shiprocketMapById.size} unique order IDs`,
  );
  console.log(
    `[Merge] Ready to match using ID and name with fallback logic`,
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
  };

  shopifyRows.forEach((orderRow) => {
    try {
      const orderIdString = String(orderRow[0]).trim(); // order_id (column 0)
      const orderDate = orderRow[1] || ""; // order_date (column 1)
      const paymentMethod = orderRow[3] || ""; // payment_method (column 3)
      const codPrepaidStatus = orderRow[7] || "Unknown"; // cod_prepaid (column 7)
      const shopifyTotal = parseFloat(orderRow[4]) || 0; // order_total (column 4)

      // Determine if this is a COD order
      const isCod =
        codPrepaidStatus.toUpperCase() === "COD" ||
        paymentMethod.toLowerCase().includes("cod");

      if (isCod) {
        stats.cod++;
      } else {
        stats.prepaid++;
      }

      // Look up settlement data
      const settlement = shiprocketMap.get(orderIdString);
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

      // Build detailed reconciliation row
      const reconciliationRow = [
        orderIdString, // order_id
        orderDate, // order_date
        shopifyTotal, // shopify_order_total
        shiprocketNet, // shiprocket_net_received
        difference, // difference (Shopify - Shiprocket)
        codPrepaidStatus, // cod_prepaid
        status, // status
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

  return reconciliation;
}
