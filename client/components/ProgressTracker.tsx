import { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertCircle, Loader } from "lucide-react";

interface ProgressStep {
  label: string;
  status: "pending" | "in-progress" | "completed" | "error";
}

interface ProgressTrackerProps {
  steps: ProgressStep[];
  currentStep: number;
  isRunning: boolean;
  error?: string;
}

export function ProgressTracker({
  steps,
  currentStep,
  isRunning,
  error,
}: ProgressTrackerProps) {
  return (
    <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-xl p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-white mb-6">
        Reconciliation Progress
      </h3>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start gap-4">
            <div className="flex-shrink-0 pt-1">
              {step.status === "pending" && (
                <Clock className="h-5 w-5 text-gray-400" />
              )}
              {step.status === "in-progress" && (
                <Loader className="h-5 w-5 text-blue-400 animate-spin" />
              )}
              {step.status === "completed" && (
                <CheckCircle className="h-5 w-5 text-green-400" />
              )}
              {step.status === "error" && (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <p
                className={`font-medium ${
                  step.status === "completed"
                    ? "text-green-300"
                    : step.status === "error"
                      ? "text-red-300"
                      : step.status === "in-progress"
                        ? "text-blue-300"
                        : "text-slate-300"
                }`}
              >
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 pt-6 border-t border-slate-600">
          <p className="text-sm font-medium text-red-300 mb-2">Error:</p>
          <p className="text-sm text-red-200 font-mono break-words">{error}</p>
        </div>
      )}

      {isRunning && (
        <div className="mt-6 pt-6 border-t border-slate-600">
          <p className="text-sm text-slate-300">
            Reconciliation in progress...
          </p>
        </div>
      )}
    </div>
  );
}
