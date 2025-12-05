import { RequestHandler } from "express";
import { calculatePerOrderCuts } from "../../src/shiprocket.js";
import { PaginatedShiprocketCutsResponse } from "@shared/api";

export const handleShiprocketCutsPaginated: RequestHandler = async (
  req,
  res,
) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.max(
      1,
      Math.min(200, parseInt(req.query.per_page as string) || 50),
    );

    console.log(
      `[HTTP] Fetching Shiprocket cuts - page ${page}, per_page ${perPage}`,
    );

    // Fetch all cuts data
    const allCuts = await calculatePerOrderCuts();

    // Calculate pagination
    const totalItems = allCuts.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const hasNext = page < totalPages;
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalItems);

    const items = allCuts.slice(startIndex, endIndex);

    // Convert array rows to objects for easier consumption
    const formattedItems = items.map((row: any) => ({
      order_id: row[0],
      awb: row[1],
      shiprocket_shipment_id: row[2],
      order_amount: row[3],
      total_remitted: row[4],
      total_charges: row[5],
      shiprocket_cut: row[6],
      shipment_status: row[7],
      has_statement_data: row[8],
      transaction_count: row[9],
      shipment_date: row[10],
    }));

    const response: PaginatedShiprocketCutsResponse = {
      status: "success",
      items: formattedItems,
      page,
      perPage,
      totalItems,
      totalPages,
      hasNext,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("[HTTP] Error fetching Shiprocket cuts:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    const response: PaginatedShiprocketCutsResponse = {
      status: "error",
      items: [],
      page: 1,
      perPage: 50,
      totalItems: 0,
      totalPages: 0,
      hasNext: false,
      timestamp: new Date().toISOString(),
      message: errorMessage,
    };

    res.status(500).json(response);
  }
};
