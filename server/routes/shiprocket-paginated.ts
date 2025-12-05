import { RequestHandler } from "express";
import { getRemittanceData } from "../../src/shiprocket.js";

const ITEMS_PER_PAGE = 50;
let cachedShiprocketData: any[] | null = null;
let cachedTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const handleShiprocketPaginated: RequestHandler = async (req, res) => {
  const timeoutMs = 26000; // 26 seconds, close to deployment's hard limit
  const startTime = Date.now();

  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        status: "error",
        items: [],
        page: 1,
        perPage: ITEMS_PER_PAGE,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        message: "Shiprocket fetch timeout: operation took too long",
        timestamp: new Date().toISOString(),
      });
    }
  }, timeoutMs);

  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);

    // Fetch settlements (use cache if available and fresh)
    if (
      !cachedShiprocketData ||
      Date.now() - cachedTimestamp > CACHE_DURATION
    ) {
      console.log(
        "[Shiprocket Paginated] Fetching fresh settlements from Shiprocket API",
      );
      cachedShiprocketData = await getRemittanceData();
      cachedTimestamp = Date.now();
    } else {
      console.log("[Shiprocket Paginated] Using cached settlements");
    }

    const totalItems = cachedShiprocketData.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (page > totalPages && totalPages > 0) {
      clearTimeout(timeoutHandle);
      return res.status(400).json({
        status: "error",
        message: `Page ${page} exceeds total pages (${totalPages})`,
        timestamp: new Date().toISOString(),
      });
    }

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const items = cachedShiprocketData.slice(startIndex, endIndex);

    clearTimeout(timeoutHandle);
    res.status(200).json({
      status: "success",
      items,
      page,
      perPage: ITEMS_PER_PAGE,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    console.error(
      `[Shiprocket Paginated] Error after ${duration}ms:`,
      errorMessage,
    );

    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }
};
