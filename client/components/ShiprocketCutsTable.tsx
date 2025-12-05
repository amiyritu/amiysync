import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShiprocketCutItem } from "@shared/api";

interface ShiprocketCutsTableProps {
  items: ShiprocketCutItem[];
  page: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  isLoading: boolean;
}

export function ShiprocketCutsTable({
  items,
  page,
  totalPages,
  totalItems,
  perPage,
  onPrevPage,
  onNextPage,
  isLoading,
}: ShiprocketCutsTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Shiprocket Cuts Per Order
        </h3>
        <p className="text-sm text-slate-300">
          Showing {Math.min((page - 1) * perPage + 1, totalItems)}-
          {Math.min(page * perPage, totalItems)} of {totalItems} orders
        </p>
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-slate-200">
                Order ID
              </th>
              <th className="px-4 py-2 text-left font-semibold text-slate-200">
                AWB
              </th>
              <th className="px-4 py-2 text-right font-semibold text-slate-200">
                Order Amount
              </th>
              <th className="px-4 py-2 text-right font-semibold text-slate-200">
                Remitted
              </th>
              <th className="px-4 py-2 text-right font-semibold text-slate-200">
                Charges
              </th>
              <th className="px-4 py-2 text-right font-semibold text-slate-200">
                Shiprocket Cut
              </th>
              <th className="px-4 py-2 text-center font-semibold text-slate-200">
                Status
              </th>
              <th className="px-4 py-2 text-center font-semibold text-slate-200">
                Txns
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-600">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No orders to display
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-600 bg-opacity-30">
                  <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                    {item.order_id || "-"}
                  </td>
                  <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                    {item.awb ? item.awb.substring(0, 15) : "-"}
                  </td>
                  <td className="px-4 py-2 text-slate-300 text-right font-mono text-xs">
                    {formatCurrency(item.order_amount)}
                  </td>
                  <td className="px-4 py-2 text-green-400 text-right font-mono text-xs">
                    {formatCurrency(item.total_remitted)}
                  </td>
                  <td className="px-4 py-2 text-orange-400 text-right font-mono text-xs">
                    {formatCurrency(item.total_charges)}
                  </td>
                  <td className="px-4 py-2 text-red-400 text-right font-mono text-xs font-semibold">
                    {formatCurrency(item.shiprocket_cut)}
                  </td>
                  <td className="px-4 py-2 text-slate-300 text-center text-xs">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        item.shipment_status === "DELIVERED"
                          ? "bg-green-900 text-green-200"
                          : item.shipment_status === "CANCELLED"
                            ? "bg-red-900 text-red-200"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {item.shipment_status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-300 text-center text-xs">
                    {item.transaction_count > 0 ? (
                      <span className="text-green-400">{item.transaction_count}</span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onPrevPage}
          disabled={page === 1 || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="text-sm text-slate-300">
          Page {page} of {totalPages}
        </div>

        <button
          onClick={onNextPage}
          disabled={page >= totalPages || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
