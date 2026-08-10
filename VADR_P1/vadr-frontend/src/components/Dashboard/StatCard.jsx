import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

export default function StatCard({ icon: Icon, label, value, trend, color, suffix = "", prefix = "", delay = 0, isFloat = false }) {
  const numericVal = typeof value === "number" ? value : parseFloat(value);
  const count = useCountUp(isFloat ? numericVal * 10 : numericVal, 1200);
  const displayVal = isFloat ? (count / 10).toFixed(1) : count;
  const isUp = trend && trend.startsWith("+");

  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${isUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-3xl font-display font-bold text-gray-900 tabular-nums">
          {prefix}{displayVal}{suffix}
        </p>
        <p className="text-gray-500 text-sm mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}
