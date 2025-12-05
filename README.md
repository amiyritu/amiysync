# Shopify-Shiprocket-Sheets Reconciliation Automation

A production-ready backend automation system that fetches Shopify orders and Shiprocket settlements, reconciles them, and writes results to a Google Sheet. Runs automatically on Netlify with optional manual triggering.

## Overview

This project automates the reconciliation of Shopify orders with Shiprocket settlement data. It:

1. **Fetches** Shopify orders via Admin REST API with pagination
2. **Fetches** Shiprocket settlements via their API with authentication
3. **Merges** the two datasets to identify matches and discrepancies
4. **Writes** the results to a Google Sheet with three tabs:
   - `Shopify_Orders` - Raw Shopify order data
   - `Shiprocket_Settlements` - Raw Shiprocket settlement data
   - `Reconciliation` - Merged view with differences flagged

5. **Runs automatically** via Netlify Scheduled Functions every 6 hours
6. **Supports manual triggers** via HTTP endpoint for testing

## Tech Stack

- **Runtime**: Node.js (compatible with Netlify Functions)
- **HTTP Requests**: Axios
- **Google Sheets**: Google API client library (googleapis)
- **Deployment**: Netlify Functions + Netlify Scheduled Functions
- **Environment**: dotenv for local development

## Prerequisites

### 1. Shopify Setup

- **Store Domain**: Your Shopify store domain (e.g., `amiynaturals.myshopify.com`)
- **Admin API Token**: Generate in Shopify Admin → Apps → App and sales channels → Develop apps → Create an app
  - Required scopes: `read_orders`

### 2. Shiprocket Setup

- **Email**: Your Shiprocket account email
- **Password**: Your Shiprocket account password
- Ensure your account has API access to settlements

### 3. Google Cloud Setup

1. Create a Google Cloud project
2. Enable the Google Sheets API
3. Create a Service Account:
   - Go to IAM & Admin → Service Accounts
   - Create a new service account
   - Generate a JSON key (it will download automatically)
   - Extract these from the JSON:
     - `private_key_id`
     - `private_key` (the full PEM string)
     - `client_email`

4. Create a Google Sheet:
   - Create three sheets (tabs):
     - `Shopify_Orders` with headers: `order_id`, `order_date`, `customer_name`, `payment_method`, `order_total`, `financial_status`, `fulfillment_status`, `cod_prepaid`
     - `Shiprocket_Settlements` with headers: `order_id`, `awb`, `order_amount`, `shipping_fee`, `cod_fee`, `adjustments`, `rto_reversal`, `net_remitted`, `remittance_date`, `crf_id`
     - `Reconciliation` with headers: `order_id`, `shopify_order_total`, `shiprocket_net_received`, `difference`, `status`, `notes`

5. Share the Google Sheet with your service account email

## Environment Variables

Create a `.env` file in the root directory for local development (do NOT commit this file):

```env
# Shopify
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=your-admin-api-token

# Shiprocket
SHIPROCKET_EMAIL=your-email@example.com
SHIPROCKET_PASSWORD=your-password

# Google Sheets
GOOGLE_SHEETS_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important**: The `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` should be the full PEM-formatted private key from your service account JSON file. Include the literal newlines as `\n` (they will be normalized in code).

### Setting Environment Variables on Netlify

1. Go to your Netlify site settings
2. Navigate to "Build & Deploy" → "Environment"
3. Add each environment variable:
   - For `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, paste the full PEM key (the code will handle `\n` normalization)

## Installation & Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file with all required variables (see Environment Variables section above).

### 3. Run Locally

**Option A: Using Netlify CLI**

```bash
npm install -g netlify-cli
netlify dev
```

This starts the development server and simulates Netlify Functions locally.

**Option B: Direct npm script**

```bash
npm run dev
```

This runs the Vite dev server for the frontend. Backend functions are not available in this mode.

### 4. Test Reconciliation Endpoint

If using Netlify CLI:

```bash
curl http://localhost:8888/api/reconcile
```

Expected response (on success):

```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "duration": "12.34s",
  "shopifyOrders": 150,
  "shiprocketRows": 145,
  "reconciledRows": 150
}
```

## Project Structure

```
.
├── src/
│   ├── shopify.js              # Shopify Admin API integration
│   ├── shiprocket.js           # Shiprocket API integration with auth
│   ├── sheets.js               # Google Sheets integration
│   ├── merge.js                # Reconciliation logic
│   └── reconcileRunner.js      # Orchestration function
├── netlify/
│   └── functions/
│       ├── reconcile.js        # HTTP endpoint (manual trigger)
│       └── reconcile-scheduled.js  # Scheduled function (every 6 hours)
├── client/                     # React frontend (optional status dashboard)
├── netlify.toml                # Netlify configuration
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## Module Documentation

### `src/shopify.js`

Exports: `getAllShopifyOrders()`

Fetches all Shopify orders with pagination, mapping each to the `Shopify_Orders` row format.

**Returns**: `Promise<Array<Array>>` - Array of order rows

### `src/shiprocket.js`

Exports:

- `login()` - Authenticates and caches JWT token
- `shiprocketGet(path, params?)` - Helper for authenticated API calls (handles token refresh)
- `getRemittanceData()` - Fetches settlement batches and orders

**Returns**: `Promise<Array<Array>>` - Array of settlement rows

### `src/sheets.js`

Exports:

- `writeToSheet(range, values)` - Writes data to a specific range
- `clearSheetData(range)` - Clears data in a range
- `clearAndWriteSheet(tabName, values)` - Clears and writes in one operation

Uses Google Service Account for authentication.

### `src/merge.js`

Exports: `mergeDatasets(shopifyRows, shiprocketRows)`

Reconciles Shopify orders with Shiprocket settlements by matching order IDs. Generates status values:

- `Reconciled` - Order amounts match (within $0.50)
- `Mismatch` - Order amounts differ by more than $0.50
- `Pending Remittance` - No Shiprocket settlement found yet

**Returns**: `Promise<Array<Array>>` - Array of reconciliation rows

### `src/reconcileRunner.js`

Exports: `runReconciliation()`

Main orchestration function that:

1. Fetches Shopify orders
2. Fetches Shiprocket settlements
3. Merges datasets
4. Writes to Google Sheets

Logs detailed progress and timing.

**Returns**: `Promise<Object>` - Summary with counts and timestamp

## Netlify Functions

### HTTP Endpoint: `GET /api/reconcile`

Manually triggers a reconciliation run.

**Request**:

```bash
curl https://your-site.netlify.app/api/reconcile
```

**Response** (on success):

```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "duration": "12.34s",
  "shopifyOrders": 150,
  "shiprocketRows": 145,
  "reconciledRows": 150
}
```

**Response** (on error):

```json
{
  "status": "error",
  "message": "Error description",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Scheduled Function: Reconciliation Every 6 Hours

Configured in `netlify/functions/reconcile-scheduled.js` with cron expression `0 */6 * * *`.

**Behavior**:

- Runs automatically at 00:00, 06:00, 12:00, 18:00 UTC every day
- Executes the full reconciliation pipeline
- Results logged to Netlify Function logs

**View Logs**:

1. Go to Netlify site dashboard
2. Navigate to "Functions"
3. Click on "reconcile-scheduled"
4. View execution history and logs

## Deployment to Netlify

### 1. Push Code to Git

```bash
git add .
git commit -m "Add reconciliation automation"
git push origin main
```

### 2. Connect to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Select your repository
4. Choose branch (usually `main`)

### 3. Configure Environment Variables

In Netlify Site Settings → Build & Deploy → Environment:

Add all variables from your `.env` file:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_ADMIN_TOKEN`
- `SHIPROCKET_EMAIL`
- `SHIPROCKET_PASSWORD`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

### 4. Trigger Deployment

Netlify automatically deploys when you push to the configured branch, or manually trigger a deploy from the site dashboard.

## Troubleshooting

### Scheduled Function Not Running

1. Check that `netlify.toml` has `schedule` defined in the function config
2. View logs in Netlify Functions dashboard
3. Verify all environment variables are set
4. Check that the cron expression is valid

### Google Sheets Write Fails

- **Error**: "Spreadsheet not found"
  - Verify `GOOGLE_SHEETS_ID` is correct
- **Error**: "Permission denied"
  - Ensure the service account email is added as an editor to the sheet
- **Error**: "Private key format error"
  - Ensure `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` uses proper newline characters (`\n`)

### Shiprocket API Errors

- **401 Unauthorized**: Email/password incorrect, or account doesn't have API access
- **403 Forbidden**: Service account or IP restrictions
- Verify credentials in Netlify environment variables

### Shopify API Errors

- **401 Unauthorized**: Invalid or expired Admin API token
- **404 Not Found**: Store domain is incorrect
- Regenerate Admin API token if needed

## Logging

All modules include console logging with prefixes:

- `[Shopify]` - Shopify operations
- `[Shiprocket]` - Shiprocket operations
- `[Sheets]` - Google Sheets operations
- `[Merge]` - Reconciliation logic
- `[Reconciliation]` - Main orchestration
- `[HTTP]` - Manual trigger endpoint
- `[Scheduled]` - Automated scheduled runs

View logs in:

- **Local development**: Terminal output
- **Netlify**: Functions dashboard → Function logs

## Performance Considerations

- **Shopify pagination**: Uses `limit=250` with `page_info` for efficiency
- **Shiprocket batches**: Fetches settlement batches first, then orders per batch
- **Google Sheets**: Clears existing data and writes fresh rows (avoids duplicates)
- **Error handling**: Continues processing on individual batch failures (Shiprocket)

Typical execution time: 10-30 seconds depending on data volume.

## Security Notes

- **Never commit secrets**: The `.env` file should never be committed to Git
- **Use Netlify environment variables**: Store all secrets in Netlify's UI
- **Private keys**: The Google service account private key is normalized in code (escaped `\n` to actual newlines)
- **Token caching**: Shiprocket JWT tokens are cached in memory (Netlify Functions are stateless, so tokens are reset per invocation)

## Future Enhancements

- Add retry logic with exponential backoff
- Implement batch processing for very large datasets
- Add email notifications on reconciliation completion
- Create a web dashboard for viewing reconciliation results
- Add filtering/export options for reconciliation data

## License

Internal use only.
