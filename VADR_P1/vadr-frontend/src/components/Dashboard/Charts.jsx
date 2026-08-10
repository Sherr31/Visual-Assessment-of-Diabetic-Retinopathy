import React from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { motion } from "framer-motion";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-blue-100 rounded-xl shadow-card px-3 py-2">
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="text-xs" style={{ color: e.color }}>
          {e.name}: <span className="font-bold">{e.value}</span>
        </p>
      ))}
    </div>
  );
};

export function SeverityPieChart({ data }) {
  return (
    <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      <h3 className="font-display font-bold text-gray-900 mb-1">Severity Distribution</h3>
      <p className="text-gray-400 text-xs mb-4">Case breakdown by DR grade</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
            dataKey="value" paddingAngle={3}>
            {data.map((e, i) => <Cell key={i} fill={e.color} />)}
          </Pie>
          <Tooltip formatter={(val) => [`${val}%`, ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-1 gap-1.5 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-xs text-gray-600">{d.name}</span>
            </div>
            <span className="text-xs font-bold text-gray-800">{d.value}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function MonthlyChart({ data }) {
  return (
    <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
      <h3 className="font-display font-bold text-gray-900 mb-1">Monthly Scan Activity</h3>
      <p className="text-gray-400 text-xs mb-4">Total scans and positive DR cases</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3A86FF" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3A86FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="scans" name="Total Scans" stroke="#3A86FF" strokeWidth={2} fill="url(#colorScans)" />
          <Area type="monotone" dataKey="positive" name="DR Positive" stroke="#EF4444" strokeWidth={2} fill="url(#colorPos)" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function ConfidenceChart({ data }) {
  return (
    <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
      <h3 className="font-display font-bold text-gray-900 mb-1">Confidence Trend</h3>
      <p className="text-gray-400 text-xs mb-4">Weekly model confidence scores</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="confidence" name="Confidence %" stroke="#10B981"
            strokeWidth={2.5} dot={{ r: 3, fill: "#10B981" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
