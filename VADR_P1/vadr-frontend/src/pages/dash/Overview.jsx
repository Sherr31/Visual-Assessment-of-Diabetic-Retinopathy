import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Scan, AlertCircle, CheckCircle, Percent, Upload, Award } from "lucide-react";
import StatCard from "../../components/Dashboard/StatCard";
import RecentTable from "../../components/Dashboard/RecentTable";
import { SeverityPieChart, MonthlyChart, ConfidenceChart } from "../../components/Dashboard/Charts";
import { fetchOverview, fetchHistory, fetchAnalytics } from "../../utils/api";

export default function Overview() {
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchOverview(), fetchHistory(), fetchAnalytics()])
      .then(([ov, hi, an]) => {
        setOverview(ov);
        setHistory(hi.records);
        setAnalytics(an);
      })
      .catch(() => {
        // Use mock data if backend offline
        setOverview({ total_scans: 260, positive_dr: 98, normal_cases: 162, avg_confidence: 93.4, today_uploads: 7, model_accuracy: 94.7, trends: { total_scans: "+12%", positive_dr: "+5%", normal_cases: "+18%", avg_confidence: "+1.2%", today_uploads: "+3", model_accuracy: "+0.3%" }});
        setHistory(MOCK_HISTORY);
        setAnalytics(MOCK_ANALYTICS);
      })
      .finally(() => setLoading(false));
  }, []);

  const STATS = overview ? [
    { icon: Scan,         label: "Total Scans",          value: overview.total_scans,    trend: overview.trends.total_scans,    color: "bg-blue-50 text-secondary" },
    { icon: AlertCircle,  label: "Positive DR Cases",    value: overview.positive_dr,    trend: overview.trends.positive_dr,    color: "bg-red-50 text-danger" },
    { icon: CheckCircle,  label: "Normal Cases",         value: overview.normal_cases,   trend: overview.trends.normal_cases,   color: "bg-emerald-50 text-success" },
    { icon: Percent,      label: "Avg Confidence Score", value: overview.avg_confidence, trend: overview.trends.avg_confidence, color: "bg-purple-50 text-purple-600", isFloat: true, suffix: "%" },
    { icon: Upload,       label: "Today's Uploads",      value: overview.today_uploads,  trend: overview.trends.today_uploads,  color: "bg-amber-50 text-warning" },
    { icon: Award,        label: "Model Accuracy",       value: overview.model_accuracy, trend: overview.trends.model_accuracy, color: "bg-teal-50 text-teal-600", isFloat: true, suffix: "%" },
  ] : [];

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 flex items-center justify-between overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, #0F4C81 0%, #3A86FF 100%)" }}
      >
        <div className="relative z-10">
          <p className="text-blue-200 text-sm font-medium mb-1">AI-Powered Diagnostic Platform</p>
          <h2 className="font-display text-white text-2xl font-bold mb-2">Visual Assessment of Diabetic Retinopathy</h2>
          <p className="text-blue-200 text-sm max-w-md">
            Automated fundus image analysis using deep learning for early detection and grading of DR severity.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-4">
          <div className="text-center">
            <p className="text-4xl font-display font-bold text-white">94.7%</p>
            <p className="text-blue-200 text-xs mt-1">Model Accuracy</p>
          </div>
          <div className="w-px h-12 bg-white/20" />
          <div className="text-center">
            <p className="text-4xl font-display font-bold text-white">5</p>
            <p className="text-blue-200 text-xs mt-1">DR Classes</p>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4" />
        <div className="absolute right-20 bottom-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2" />
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {STATS.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.07} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {analytics && <MonthlyChart data={analytics.monthly_activity} />}
        </div>
        {analytics && <SeverityPieChart data={analytics.severity_distribution} />}
      </div>

      {analytics && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ConfidenceChart data={analytics.confidence_trend} />
          <ModelMetrics metrics={analytics.model_metrics} />
        </div>
      )}

      {/* Table */}
      <RecentTable data={history} />
    </div>
  );
}

function ModelMetrics({ metrics }) {
  const items = [
    { label: "Accuracy",  value: metrics.accuracy,  color: "#3A86FF" },
    { label: "Precision", value: metrics.precision,  color: "#10B981" },
    { label: "Recall",    value: metrics.recall,     color: "#F59E0B" },
    { label: "F1 Score",  value: metrics.f1_score,   color: "#7C3AED" },
    { label: "AUC-ROC",   value: (metrics.auc_roc * 100).toFixed(1), color: "#EF4444" },
  ];
  return (
    <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
      <h3 className="font-display font-bold text-gray-900 mb-1">Model Performance</h3>
      <p className="text-gray-400 text-xs mb-5">RetinaNet-v2.3 evaluation metrics</p>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.label}>
            <div className="flex justify-between mb-1.5">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-bold text-gray-900">{item.value}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: item.color }}
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-32 bg-gray-200 rounded-2xl" />
      <div className="grid grid-cols-6 gap-4">
        {Array(6).fill(0).map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl" />)}
      </div>
    </div>
  );
}

const MOCK_HISTORY = [
  { id: "PAT-1000", name: "Ahmad Raza", date: "2024-12-01", severity: "No DR", severity_index: 0, confidence: 96.2, eye: "Left Eye" },
  { id: "PAT-1001", name: "Fatima Khan", date: "2024-12-03", severity: "Mild DR", severity_index: 1, confidence: 88.7, eye: "Right Eye" },
  { id: "PAT-1002", name: "Muhammad Ali", date: "2024-12-05", severity: "Moderate DR", severity_index: 2, confidence: 91.3, eye: "Left Eye" },
  { id: "PAT-1003", name: "Ayesha Malik", date: "2024-12-07", severity: "Severe DR", severity_index: 3, confidence: 85.9, eye: "Right Eye" },
  { id: "PAT-1004", name: "Usman Tariq", date: "2024-12-09", severity: "No DR", severity_index: 0, confidence: 97.1, eye: "Left Eye" },
  { id: "PAT-1005", name: "Zainab Hussain", date: "2024-12-11", severity: "Proliferative DR", severity_index: 4, confidence: 93.4, eye: "Right Eye" },
];
const MOCK_ANALYTICS = {
  monthly_activity: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    .map(m => ({ month: m, scans: Math.floor(Math.random()*50+15), positive: Math.floor(Math.random()*20+5) })),
  severity_distribution: [
    { name: "No DR", value: 42, color: "#10B981" },
    { name: "Mild DR", value: 23, color: "#F59E0B" },
    { name: "Moderate DR", value: 19, color: "#F97316" },
    { name: "Severe DR", value: 10, color: "#EF4444" },
    { name: "Proliferative DR", value: 6, color: "#7C3AED" },
  ],
  confidence_trend: Array.from({ length: 12 }, (_, i) => ({ week: `W${i+1}`, confidence: +(88+Math.random()*9).toFixed(1) })),
  model_metrics: { accuracy: 94.7, precision: 93.2, recall: 95.8, f1_score: 94.5, auc_roc: 0.971 },
};
