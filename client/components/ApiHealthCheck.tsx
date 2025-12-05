import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';

interface ApiStatus {
  status: boolean;
  message: string;
}

interface HealthCheckResult {
  timestamp: string;
  shopify: ApiStatus;
  shiprocket: ApiStatus;
  sheets: ApiStatus;
  allHealthy: boolean;
}

interface ApiHealthCheckProps {
  onCheck?: (result: HealthCheckResult) => void;
}

export function ApiHealthCheck({ onCheck }: ApiHealthCheckProps) {
  const [healthStatus, setHealthStatus] = useState<HealthCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkApis = async () => {
    try {
      setIsChecking(true);
      const response = await fetch('/api/health-check');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: HealthCheckResult = await response.json();
      setHealthStatus(data);
      setLastChecked(new Date());

      if (onCheck) {
        onCheck(data);
      }
    } catch (error) {
      console.error('Health check error:', error);
      setHealthStatus({
        timestamp: new Date().toISOString(),
        shopify: { status: false, message: 'Check failed' },
        shiprocket: { status: false, message: 'Check failed' },
        sheets: { status: false, message: 'Check failed' },
        allHealthy: false,
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check on mount
  useEffect(() => {
    checkApis();
  }, []);

  const ApiCard = ({
    name,
    status,
    message,
  }: {
    name: string;
    status: boolean;
    message: string;
  }) => (
    <div className="bg-white bg-opacity-40 rounded-lg p-4 border border-slate-300 border-opacity-30">
      <div className="flex items-center gap-3 mb-2">
        {status ? (
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
        )}
        <h4 className="font-medium text-slate-900">{name}</h4>
      </div>
      <p className={`text-sm ${status ? 'text-green-700' : 'text-red-700'}`}>
        {message}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Health Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {healthStatus ? (
          <>
            <ApiCard
              name="Shopify API"
              status={healthStatus.shopify.status}
              message={healthStatus.shopify.message}
            />
            <ApiCard
              name="Shiprocket API"
              status={healthStatus.shiprocket.status}
              message={healthStatus.shiprocket.message}
            />
            <ApiCard
              name="Google Sheets"
              status={healthStatus.sheets.status}
              message={healthStatus.sheets.message}
            />
          </>
        ) : (
          <>
            <div className="bg-slate-300 bg-opacity-20 rounded-lg p-4 animate-pulse" />
            <div className="bg-slate-300 bg-opacity-20 rounded-lg p-4 animate-pulse" />
            <div className="bg-slate-300 bg-opacity-20 rounded-lg p-4 animate-pulse" />
          </>
        )}
      </div>

      {/* Check Button and Timestamp */}
      <div className="flex items-center justify-between">
        <button
          onClick={checkApis}
          disabled={isChecking}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isChecking ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isChecking ? 'Checking...' : 'Check APIs'}
        </button>

        {lastChecked && (
          <p className="text-xs text-slate-600 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Checked at {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
