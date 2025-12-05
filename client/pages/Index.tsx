import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Play } from 'lucide-react';
import { ReconciliationResponse } from '@shared/api';

export default function Index() {
  const [reconciliationStatus, setReconciliationStatus] = useState<ReconciliationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Fetch reconciliation status
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/reconcile');
      const data: ReconciliationResponse = await response.json();
      setReconciliationStatus(data);
      setLastUpdated(new Date());

      if (data.status !== 'success') {
        console.error('Reconciliation error:', data.error);
      }
    } catch (error) {
      console.error('Error fetching reconciliation status:', error);
      setReconciliationStatus({
        status: 'error',
        error: 'Failed to connect to reconciliation service',
      });
    } finally {
      setIsLoading(false);
    }
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
      return (
        <RefreshCw className="h-12 w-12 text-blue-500 animate-spin" />
      );
    }

    if (!reconciliationStatus) {
      return <Clock className="h-12 w-12 text-gray-400" />;
    }

    if (reconciliationStatus.status === 'success') {
      return <CheckCircle className="h-12 w-12 text-green-500" />;
    }

    return <AlertCircle className="h-12 w-12 text-red-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Running Reconciliation...';
    if (!reconciliationStatus) return 'Ready to Run';
    if (reconciliationStatus.status === 'success') return 'Last Run Successful';
    return 'Last Run Failed';
  };

  const getStatusColor = () => {
    if (isLoading) return 'border-blue-200 bg-blue-50';
    if (!reconciliationStatus) return 'border-gray-200 bg-gray-50';
    if (reconciliationStatus.status === 'success') return 'border-green-200 bg-green-50';
    return 'border-red-200 bg-red-50';
  };

  const getTextColor = () => {
    if (isLoading) return 'text-blue-900';
    if (!reconciliationStatus) return 'text-gray-900';
    if (reconciliationStatus.status === 'success') return 'text-green-900';
    return 'text-red-900';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
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
        <div className={`rounded-2xl border-2 p-8 sm:p-12 mb-8 transition-all duration-300 ${getStatusColor()}`}>
          <div className="flex items-center gap-6 mb-8">
            <div className="flex-shrink-0">
              {getStatusIcon()}
            </div>
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
          {reconciliationStatus && reconciliationStatus.status === 'success' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white bg-opacity-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700">Shopify Orders</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {reconciliationStatus.shopifyOrders}
                </p>
              </div>
              <div className="bg-white bg-opacity-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700">Shiprocket Rows</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {reconciliationStatus.shiprocketRows}
                </p>
              </div>
              <div className="bg-white bg-opacity-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700">Reconciled Rows</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {reconciliationStatus.reconciledRows}
                </p>
              </div>
            </div>
          )}

          {reconciliationStatus && reconciliationStatus.status === 'error' && (
            <div className="bg-white bg-opacity-50 rounded-lg p-6">
              <p className="text-sm font-medium text-slate-700 mb-2">Error Details</p>
              <p className="font-mono text-sm text-red-700 break-words">
                {reconciliationStatus.error}
              </p>
            </div>
          )}

          {/* Metadata */}
          {reconciliationStatus && reconciliationStatus.timestamp && (
            <div className="mt-6 pt-6 border-t border-slate-300 border-opacity-30 text-xs text-slate-600">
              <p>
                Timestamp: {new Date(reconciliationStatus.timestamp).toLocaleString()} | Duration:{' '}
                {reconciliationStatus.duration}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 text-lg"
          >
            <Play className="h-6 w-6" />
            {isLoading ? 'Running...' : 'Run Reconciliation'}
          </button>
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`flex-1 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 text-lg ${
              autoRefreshEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
            }`}
          >
            <RefreshCw className="h-6 w-6" />
            {autoRefreshEnabled ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
          </button>
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
          <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4">
              API Integration
            </h3>
            <p className="text-slate-300 text-sm mb-3">
              This system integrates with:
            </p>
            <ul className="text-slate-200 text-sm space-y-1 ml-4 list-disc">
              <li>Shopify Admin API</li>
              <li>Shiprocket Settlement API</li>
              <li>Google Sheets API</li>
            </ul>
          </div>

          {/* Results Location */}
          <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4">
              Results Location
            </h3>
            <p className="text-slate-300 text-sm">
              All reconciliation results are written to a Google Sheet with three tabs:
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
                <span className="font-semibold">Mismatch:</span> Amount difference &gt; $0.50
              </li>
              <li className="text-orange-300">
                <span className="font-semibold">Pending Remittance:</span> No Shiprocket data
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-400 text-sm">
          <p>
            For support and documentation, see the{' '}
            <span className="font-mono text-slate-300">README.md</span> file
          </p>
        </div>
      </div>
    </div>
  );
}
