import { RequestHandler } from "express";
import { getAllShopifyOrders } from "../../src/shopify.js";

const ITEMS_PER_PAGE = 50;
let cachedShopifyOrders: any[] | null = null;
let cachedTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const handleShopifyPaginated: RequestHandler = async (req, res) => {
  const timeoutMs = 24000; // 24 seconds, well under Netlify's 26 second limit
  const startTime = Date.now();

  const timeoutHandle = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        status: "error",
        message: "Shopify fetch timeout: operation took too long",
        timestamp: new Date().toISOString(),
      });
    }
  }, timeoutMs);

  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);

    // Fetch orders (use cache if available and fresh)
    if (!cachedShopifyOrders || Date.now() - cachedTimestamp > CACHE_DURATION) {
      console.log("[Shopify Paginated] Fetching fresh orders from Shopify API");
      cachedShopifyOrders = await getAllShopifyOrders();
      cachedTimestamp = Date.now();
    } else {
      console.log("[Shopify Paginated] Using cached orders");
    }

    const totalItems = cachedShopifyOrders.length;
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
    const items = cachedShopifyOrders.slice(startIndex, endIndex);

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
      `[Shopify Paginated] Error after ${duration}ms:`,
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
