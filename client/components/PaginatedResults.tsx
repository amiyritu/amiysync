import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginatedResultsProps {
  title: string;
  items: any[];
  page: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  columns: string[];
  onPrevPage: () => void;
  onNextPage: () => void;
  isLoading: boolean;
}

export function PaginatedResults({
  title,
  items,
  page,
  totalPages,
  totalItems,
  perPage,
  columns,
  onPrevPage,
  onNextPage,
  isLoading,
}: PaginatedResultsProps) {
  return (
    <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-300">
          Showing {Math.min((page - 1) * perPage + 1, totalItems)}-
          {Math.min(page * perPage, totalItems)} of {totalItems} items
        </p>
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-semibold text-slate-200"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-600">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No items to display
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-600 bg-opacity-30">
                  {columns.map((col, cidx) => (
                    <td
                      key={cidx}
                      className="px-4 py-2 text-slate-300 font-mono text-xs"
                    >
                      {typeof item[cidx] === "string"
                        ? item[cidx].substring(0, 50)
                        : typeof item[cidx] === "number"
                          ? item[cidx].toFixed(2)
                          : item[cidx] || "-"}
                    </td>
                  ))}
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
