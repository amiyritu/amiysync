import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, AlertCircle, Clock, Play } from "lucide-react";
import {
  ReconciliationResponse,
  PaginatedShopifyResponse,
  PaginatedShiprocketResponse,
  CompleteReconciliationResponse,
} from "@shared/api";
import { ApiHealthCheck } from "../components/ApiHealthCheck";
import { ProgressTracker } from "../components/ProgressTracker";
import { PaginatedResults } from "../components/PaginatedResults";

interface ProgressStep {
  label: string;
  status: "pending" | "in-progress" | "completed" | "error";
}

interface ReconciliationStats {
  reconciled: number;
  mismatch: number;
  pendingRemittance: number;
  prepaidNoRemittance: number;
}

export default function Index() {
  const [reconciliationStatus, setReconciliationStatus] =
    useState<ReconciliationResponse | null>(null);
  const [reconciliationStats, setReconciliationStats] = useState<ReconciliationStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Paginated results state
  const [shopifyResults, setShopifyResults] = useState<any[]>([]);
  const [shopifyPage, setShopifyPage] = useState(1);
  const [shopifyTotalPages, setShopifyTotalPages] = useState(0);
  const [shopifyTotalItems, setShopifyTotalItems] = useState(0);
  const [shopifyLoading, setShopifyLoading] = useState(false);

  const [shiprocketResults, setShiprocketResults] = useState<any[]>([]);
  const [shiprocketPage, setShiprocketPage] = useState(1);
  const [shiprocketTotalPages, setShiprocketTotalPages] = useState(0);
  const [shiprocketTotalItems, setShiprocketTotalItems] = useState(0);
  const [shiprocketLoading, setShiprocketLoading] = useState(false);

  // Progress tracking state
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { label: "Fetching Shopify orders", status: "pending" },
    { label: "Fetching Shiprocket settlements", status: "pending" },
    { label: "Merging datasets", status: "pending" },
    { label: "Writing to Google Sheets", status: "pending" },
  ]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // Fetch paginated Shopify results
  const fetchShopifyPage = async (page: number) => {
    try {
      setShopifyLoading(true);
      const response = await fetch(`/api/reconcile/shopify?page=${page}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PaginatedShopifyResponse = await response.json();

      if (data.status === "success") {
        setShopifyResults(data.items);
        setShopifyPage(data.page);
        setShopifyTotalPages(data.totalPages);
        setShopifyTotalItems(data.totalItems);
      } else {
        console.error("Shopify API error:", data.message);
      }
    } catch (error) {
      console.error("Error fetching Shopify page:", error);
    } finally {
      setShopifyLoading(false);
    }
  };

  // Fetch paginated Shiprocket results
  const fetchShiprocketPage = async (page: number) => {
    try {
      setShiprocketLoading(true);
      const response = await fetch(`/api/reconcile/shiprocket?page=${page}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PaginatedShiprocketResponse = await response.json();

      if (data.status === "success") {
        setShiprocketResults(data.items);
        setShiprocketPage(data.page);
        setShiprocketTotalPages(data.totalPages);
        setShiprocketTotalItems(data.totalItems);
      } else {
        console.error("Shiprocket API error:", data.message);
      }
    } catch (error) {
      console.error("Error fetching Shiprocket page:", error);
    } finally {
      setShiprocketLoading(false);
    }
  };

  // Complete reconciliation with progress tracking
  const completeReconciliation = async () => {
    try {
      setIsReconciling(true);
      setReconcileError(null);
      resetProgressSteps();

      // Step 1: Shopify orders
      updateProgressStep(0, "in-progress");
      await fetchShopifyPage(1);
      updateProgressStep(0, "completed");

      // Step 2: Shiprocket settlements
      updateProgressStep(1, "in-progress");
      await fetchShiprocketPage(1);
      updateProgressStep(1, "completed");

      // Step 3 & 4: Merge and write
      updateProgressStep(2, "in-progress");
      updateProgressStep(3, "in-progress");

      const response = await fetch("/api/reconcile/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CompleteReconciliationResponse = await response.json();

      if (data.status === "success") {
        updateProgressStep(2, "completed");
        updateProgressStep(3, "completed");
        setReconciliationStatus({
          status: "success",
          timestamp: data.timestamp,
          duration: data.duration,
          shopifyOrders: data.shopifyOrders,
          shiprocketRows: data.shiprocketRows,
          reconciledRows: data.reconciledRows,
        });
        if (data.reconciliationStats) {
          setReconciliationStats(data.reconciliationStats);
        }
        setLastUpdated(new Date());
      } else {
        throw new Error(data.message || "Reconciliation failed");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to complete reconciliation";
      setReconcileError(errorMessage);
      setReconciliationStatus({
        status: "error",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      updateProgressStep(getCurrentProgressStep(), "error");
    } finally {
      setIsReconciling(false);
    }
  };

  // Fetch reconciliation status (old endpoint)
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/reconcile");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          "Invalid response: expected JSON, got " + (contentType || "unknown"),
        );
      }

      const data: ReconciliationResponse = await response.json();
      setReconciliationStatus(data);
      setLastUpdated(new Date());

      if (data.status !== "success") {
        console.error("Reconciliation error:", data.error);
      }
    } catch (error) {
      console.error("Error fetching reconciliation status:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to connect to reconciliation service. Make sure all environment variables are configured.";

      setReconciliationStatus({
        status: "error",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Progress tracking helpers
  const updateProgressStep = (
    index: number,
    status: ProgressStep["status"],
  ) => {
    setProgressSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status };
      return updated;
    });
  };

  const resetProgressSteps = () => {
    setProgressSteps([
      { label: "Fetching Shopify orders", status: "pending" },
      { label: "Fetching Shiprocket settlements", status: "pending" },
      { label: "Merging datasets", status: "pending" },
      { label: "Writing to Google Sheets", status: "pending" },
    ]);
  };

  const getCurrentProgressStep = () => {
    return progressSteps.findIndex((step) => step.status === "in-progress");
  };

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefreshEnabled) {
      interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefreshEnabled]);

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-12 w-12 text-blue-500 animate-spin" />;
    }

    if (!reconciliationStatus) {
      return <Clock className="h-12 w-12 text-gray-400" />;
    }

    if (reconciliationStatus.status === "success") {
      return <CheckCircle className="h-12 w-12 text-green-500" />;
    }

    return <AlertCircle className="h-12 w-12 text-red-500" />;
  };

  const getStatusText = () => {
    if (isLoading || isReconciling) return "Running Reconciliation...";
    if (!reconciliationStatus) return "Ready to Run";
    if (reconciliationStatus.status === "success") return "Last Run Successful";
    return "Last Run Failed";
  };

  const getStatusColor = () => {
    if (isLoading || isReconciling) return "border-blue-200 bg-blue-50";
    if (!reconciliationStatus) return "border-gray-200 bg-gray-50";
    if (reconciliationStatus.status === "success")
      return "border-green-200 bg-green-50";
    return "border-red-200 bg-red-50";
  };

  const getTextColor = () => {
    if (isLoading || isReconciling) return "text-blue-900";
    if (!reconciliationStatus) return "text-gray-900";
    if (reconciliationStatus.status === "success") return "text-green-900";
    return "text-red-900";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
            Reconciliation Dashboard
          </h1>
          <p className="text-lg text-slate-300">
            Automated Shopify-Shiprocket reconciliation system
          </p>
        </div>

        {/* Main Status Card */}
        <div
          className={`rounded-2xl border-2 p-8 sm:p-12 mb-8 transition-all duration-300 ${getStatusColor()}`}
        >
          <div className="flex items-center gap-6 mb-8">
            <div className="flex-shrink-0">{getStatusIcon()}</div>
            <div>
              <h2 className={`text-2xl font-bold ${getTextColor()}`}>
                {getStatusText()}
              </h2>
              {lastUpdated && (
                <p className="text-sm text-slate-600 mt-1">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Status Details */}
          {reconciliationStatus &&
            reconciliationStatus.status === "success" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white bg-opacity-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Shopify Orders
                  </p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {reconciliationStatus.shopifyOrders}
                  </p>
                </div>
                <div className="bg-white bg-opacity-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Shiprocket Rows
                  </p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {reconciliationStatus.shiprocketRows}
                  </p>
                </div>
                <div className="bg-white bg-opacity-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Reconciled Rows
                  </p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {reconciliationStatus.reconciledRows}
                  </p>
                </div>
              </div>
            )}

          {reconciliationStats && reconciliationStatus?.status === "success" && (
            <div className="mt-6 pt-6 border-t border-slate-300 border-opacity-30">
              <p className="text-sm font-medium text-slate-700 mb-4">
                Reconciliation Status Breakdown
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-100 bg-opacity-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-900">Reconciled</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {reconciliationStats.reconciled}
                  </p>
                </div>
                <div className="bg-yellow-100 bg-opacity-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-900">Mismatches</p>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">
                    {reconciliationStats.mismatch}
                  </p>
                </div>
                <div className="bg-orange-100 bg-opacity-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-orange-900">Pending</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {reconciliationStats.pendingRemittance}
                  </p>
                </div>
                <div className="bg-blue-100 bg-opacity-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-blue-900">Prepaid</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {reconciliationStats.prepaidNoRemittance}
                  </p>
                </div>
              </div>
            </div>
          )}

          {reconciliationStatus && reconciliationStatus.status === "error" && (
            <div className="bg-white bg-opacity-50 rounded-lg p-6">
              <p className="text-sm font-medium text-slate-700 mb-2">
                Error Details
              </p>
              <p className="font-mono text-sm text-red-700 break-words">
                {reconciliationStatus.error}
              </p>
            </div>
          )}

          {/* Metadata */}
          {reconciliationStatus && reconciliationStatus.timestamp && (
            <div className="mt-6 pt-6 border-t border-slate-300 border-opacity-30 text-xs text-slate-600">
              <p>
                Timestamp:{" "}
                {new Date(reconciliationStatus.timestamp).toLocaleString()} |
                Duration: {reconciliationStatus.duration}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={completeReconciliation}
            disabled={isLoading || isReconciling}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 text-lg"
          >
            <Play className="h-6 w-6" />
            {isLoading || isReconciling ? "Running..." : "Run Reconciliation"}
          </button>
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`flex-1 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 text-lg ${
              autoRefreshEnabled
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-slate-100"
            }`}
          >
            <RefreshCw className="h-6 w-6" />
            {autoRefreshEnabled ? "Auto-Refresh On" : "Auto-Refresh Off"}
          </button>
        </div>

        {/* Progress Tracker */}
        {isReconciling && (
          <div className="mb-8">
            <ProgressTracker
              steps={progressSteps}
              currentStep={getCurrentProgressStep()}
              isRunning={isReconciling}
              error={reconcileError || undefined}
            />
          </div>
        )}

        {/* Paginated Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PaginatedResults
            title="Shopify Orders"
            items={shopifyResults}
            page={shopifyPage}
            totalPages={shopifyTotalPages}
            totalItems={shopifyTotalItems}
            perPage={50}
            columns={[
              "Order ID",
              "Name",
              "Date",
              "Customer",
              "Total",
              "Status",
            ]}
            onPrevPage={() => {
              if (shopifyPage > 1) fetchShopifyPage(shopifyPage - 1);
            }}
            onNextPage={() => {
              if (shopifyPage < shopifyTotalPages)
                fetchShopifyPage(shopifyPage + 1);
            }}
            isLoading={shopifyLoading}
          />
          <PaginatedResults
            title="Shiprocket Settlements"
            items={shiprocketResults}
            page={shiprocketPage}
            totalPages={shiprocketTotalPages}
            totalItems={shiprocketTotalItems}
            perPage={50}
            columns={[
              "Channel Order ID",
              "UTE",
              "Order ID",
              "AWB",
              "Amount",
              "Net",
            ]}
            onPrevPage={() => {
              if (shiprocketPage > 1) fetchShiprocketPage(shiprocketPage - 1);
            }}
            onNextPage={() => {
              if (shiprocketPage < shiprocketTotalPages)
                fetchShiprocketPage(shiprocketPage + 1);
            }}
            isLoading={shiprocketLoading}
          />
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Scheduled Runs */}
          <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              Scheduled Runs
            </h3>
            <p className="text-slate-300 text-sm mb-2">
              This reconciliation runs automatically every 6 hours at:
            </p>
            <ul className="text-slate-200 text-sm font-mono space-y-1 ml-4">
              <li>00:00 UTC</li>
              <li>06:00 UTC</li>
              <li>12:00 UTC</li>
              <li>18:00 UTC</li>
            </ul>
          </div>

          {/* API Information */}
          <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm col-span-1 sm:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-4">
              API Integration Status
            </h3>
            <ApiHealthCheck />
          </div>

          {/* Results Location */}
          <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4">
              Results Location
            </h3>
            <p className="text-slate-300 text-sm">
              All reconciliation results are written to a Google Sheet with
              three tabs:
            </p>
            <ul className="text-slate-200 text-sm font-mono space-y-1 ml-4 mt-3 list-disc">
              <li>Shopify_Orders</li>
              <li>Shiprocket_Settlements</li>
              <li>Reconciliation</li>
            </ul>
          </div>

          {/* Status Meanings */}
          <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4">
              Reconciliation Status Codes
            </h3>
            <ul className="text-sm space-y-2">
              <li className="text-green-300">
                <span className="font-semibold">Reconciled:</span> Amounts match
              </li>
              <li className="text-yellow-300">
                <span className="font-semibold">Mismatch:</span> Amount
                difference &gt; $0.50
              </li>
              <li className="text-orange-300">
                <span className="font-semibold">Pending Remittance:</span> No
                Shiprocket data
              </li>
            </ul>
          </div>
        </div>

        {/* Development Notes */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 bg-slate-700 bg-opacity-50 border border-yellow-600 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-yellow-300 mb-3">
              Development Mode Notice
            </h3>
            <p className="text-slate-300 text-sm mb-3">
              To test the reconciliation locally, use:{" "}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded">
                netlify dev
              </span>{" "}
              instead of{" "}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded">
                pnpm run dev
              </span>
            </p>
            <p className="text-slate-300 text-sm">
              Then configure environment variables in a{" "}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded">
                .env
              </span>{" "}
              file (see{" "}
              <span className="font-mono bg-slate-800 px-2 py-1 rounded">
                .env.example
              </span>
              ).
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-400 text-sm">
          <p>
            For support and documentation, see the{" "}
            <span className="font-mono text-slate-300">README.md</span> file
          </p>
        </div>
      </div>
    </div>
  );
}
