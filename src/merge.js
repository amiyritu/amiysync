/**
 * Merges Shopify orders with Shiprocket settlements to create reconciliation rows
 * @param {Array<Array>} shopifyRows - Array of Shopify order rows
 * @param {Array<Array>} shiprocketRows - Array of Shiprocket settlement rows
 * @returns {Array<Array>} Array of reconciliation rows
 */
export function mergeDatasets(shopifyRows, shiprocketRows) {
  console.log(
    `[Merge] Starting reconciliation with ${shopifyRows.length} Shopify orders and ${shiprocketRows.length} Shiprocket rows`,
  );

  // Build a map of Shiprocket settlements keyed by order_id
  const shiprocketMap = new Map();
  shiprocketRows.forEach((row) => {
    const orderId = String(row[0]); // order_id is first column
    // Use the last occurrence if there are duplicates
    shiprocketMap.set(orderId, row);
  });

  console.log(
    `[Merge] Built Shiprocket map with ${shiprocketMap.size} unique order IDs`,
  );

  // Reconcile each Shopify order with Shiprocket data
  const reconciliation = [];

  shopifyRows.forEach((orderRow) => {
    const orderIdString = String(orderRow[0]); // order_id
    const shopifyTotal = parseFloat(orderRow[4]) || 0; // order_total

    const sr = shiprocketMap.get(orderIdString);
    const shiprocketNet = sr ? parseFloat(sr[7]) || 0 : 0; // net_remitted (column 8 in 1-indexed, column 7 in 0-indexed)

    const diff = shopifyTotal - shiprocketNet;

    let status;
    if (!sr) {
      status = "Pending Remittance";
    } else if (Math.abs(diff) < 0.5) {
      status = "Reconciled";
    } else {
      status = "Mismatch";
    }

    const reconciliationRow = [
      orderIdString, // order_id
      shopifyTotal, // shopify_order_total
      shiprocketNet, // shiprocket_net_received
      diff, // difference
      status, // status
      "", // notes (empty for manual entry)
    ];

    reconciliation.push(reconciliationRow);
  });

  console.log(
    `[Merge] Reconciliation complete: ${reconciliation.length} rows generated`,
  );

  // Log summary statistics
  const reconciled = reconciliation.filter((r) => r[4] === "Reconciled").length;
  const mismatches = reconciliation.filter((r) => r[4] === "Mismatch").length;
  const pending = reconciliation.filter(
    (r) => r[4] === "Pending Remittance",
  ).length;

  console.log(
    `[Merge] Summary - Reconciled: ${reconciled}, Mismatches: ${mismatches}, Pending: ${pending}`,
  );

  return reconciliation;
}
