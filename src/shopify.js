import axios from "axios";

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!domain || !token) {
    throw new Error(
      "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_TOKEN environment variables",
    );
  }

  return { domain, token };
}

function createShopifyApi() {
  const { domain, token } = getShopifyConfig();

  return axios.create({
    baseURL: `https://${domain}/admin/api/2023-10`,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Fetches all Shopify orders with pagination
 * Maps each order to a row format for Shopify_Orders sheet
 * @returns {Promise<Array>} Array of order rows
 */
export async function getAllShopifyOrders() {
  const shopifyApi = createShopifyApi();
  const orders = [];
  let hasNextPage = true;
  let pageInfo = null;

  try {
    while (hasNextPage) {
      const params = {
        limit: 250,
        status: "any",
      };

      if (pageInfo) {
        params.page_info = pageInfo;
      }

      console.log("[Shopify] Fetching orders page...");
      const response = await shopifyApi.get("/orders.json", { params });

      const fetchedOrders = response.data.orders || [];

      // Map each order to the Shopify_Orders row format
      fetchedOrders.forEach((order) => {
        const row = [
          order.id, // order_id
          order.created_at, // order_date
          `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(), // customer_name
          order.gateway || "", // payment_method
          parseFloat(order.total_price), // order_total
          order.financial_status || "", // financial_status
          order.fulfillment_status || "", // fulfillment_status
          order.gateway && order.gateway.toLowerCase().includes("cod")
            ? "COD"
            : "Prepaid", // cod_prepaid
        ];
        orders.push(row);
      });

      // Check for pagination via Link header
      const linkHeader = response.headers.link;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          const nextUrl = new URL(nextMatch[1]);
          pageInfo = nextUrl.searchParams.get("page_info");
          hasNextPage = true;
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }

      console.log(
        `[Shopify] Fetched ${fetchedOrders.length} orders (total so far: ${orders.length})`,
      );
    }

    console.log(`[Shopify] Total orders fetched: ${orders.length}`);
    return orders;
  } catch (error) {
    const domain = process.env.SHOPIFY_STORE_DOMAIN || "NOT_SET";
    const errorDetails =
      error.response?.data || error.response?.status || error.message;

    console.error("[Shopify] Error details:", {
      domain,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: errorDetails,
      message: error.message,
    });

    const statusCode = error.response?.status || "unknown";
    const suggestion =
      statusCode === 400
        ? "Check that SHOPIFY_STORE_DOMAIN (e.g., 'store.myshopify.com' without https://) and SHOPIFY_ADMIN_TOKEN are correct."
        : statusCode === 401
          ? "SHOPIFY_ADMIN_TOKEN is invalid or expired."
          : "";

    throw new Error(
      `Failed to fetch Shopify orders (${statusCode}): ${error.message}. ${suggestion}`,
    );
  }
}
