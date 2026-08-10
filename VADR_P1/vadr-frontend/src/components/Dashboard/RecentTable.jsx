import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import SeverityBadge from "./SeverityBadge";

const PAGE_SIZE = 6;

export default function RecentTable({ data = [] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [sortKey, setSortKey] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);

  const SEVERITIES = ["All", "No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"];

  const filtered = data
    .filter(r =>
      (severityFilter === "All" || r.severity === severityFilter) &&
      (r.id.toLowerCase().includes(query.toLowerCase()) ||
       r.name.toLowerCase().includes(query.toLowerCase()))
    )
    .sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === "confidence") { va = parseFloat(va); vb = parseFloat(vb); }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }) => sortKey === k
    ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
    : <ChevronDown className="w-3 h-3 opacity-30" />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-gray-900 text-lg">Recent Assessments</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              className="input-field pl-8 w-44 text-xs py-2"
              placeholder="Search patients..."
            />
          </div>
          <select
            value={severityFilter}
            onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
            className="input-field text-xs py-2 w-36"
          >
            {SEVERITIES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {[
                { key: "id",         label: "Patient ID" },
                { key: "name",       label: "Name" },
                { key: "date",       label: "Date" },
                { key: "severity",   label: "Severity" },
                { key: "confidence", label: "Confidence" },
                { key: "eye",        label: "Eye" },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-primary select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.label} <SortIcon k={col.key} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors cursor-pointer"
              >
                <td className="py-3.5 px-3">
                  <span className="font-mono text-xs font-semibold text-primary bg-light-blue px-2 py-1 rounded-lg">
                    {row.id}
                  </span>
                </td>
                <td className="py-3.5 px-3 text-sm font-medium text-gray-800">{row.name}</td>
                <td className="py-3.5 px-3 text-sm text-gray-500">{row.date}</td>
                <td className="py-3.5 px-3"><SeverityBadge severity={row.severity} /></td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
                      <div
                        className="h-full bg-gradient-to-r from-secondary to-primary rounded-full"
                        style={{ width: `${row.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 tabular-nums">{row.confidence}%</span>
                  </div>
                </td>
                <td className="py-3.5 px-3 text-sm text-gray-500">{row.eye}</td>
              </motion.tr>
            ))}
            {pageData.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
        <p className="text-xs text-gray-400">
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                page === n ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage(p => p + 1)}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
