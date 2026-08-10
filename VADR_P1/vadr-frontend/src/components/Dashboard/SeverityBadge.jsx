import React from "react";

const SEVERITY_STYLES = {
  "No DR":           "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Mild DR":         "bg-amber-50 text-amber-700 border border-amber-200",
  "Moderate DR":     "bg-orange-50 text-orange-700 border border-orange-200",
  "Severe DR":       "bg-red-50 text-red-700 border border-red-200",
  "Proliferative DR":"bg-purple-50 text-purple-700 border border-purple-200",
};

const SEVERITY_DOT = {
  "No DR":           "bg-emerald-500",
  "Mild DR":         "bg-amber-500",
  "Moderate DR":     "bg-orange-500",
  "Severe DR":       "bg-red-500",
  "Proliferative DR":"bg-purple-500",
};

export default function SeverityBadge({ severity }) {
  const cls = SEVERITY_STYLES[severity] || "bg-gray-50 text-gray-600 border border-gray-200";
  const dot = SEVERITY_DOT[severity] || "bg-gray-400";
  return (
    <span className={`badge ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      {severity}
    </span>
  );
}
