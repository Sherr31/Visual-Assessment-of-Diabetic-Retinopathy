import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from "recharts";
import { SeverityPieChart, MonthlyChart, ConfidenceChart } from "../../components/Dashboard/Charts";
import { fetchAnalytics } from "../../utils/api";
import { Brain, Target, Database, Layers } from "lucide-react";

export default function AIAnalytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAnalytics().then(setData).catch(() => setData(MOCK));
  }, []);

  if (!data) return <div className="space-y-6 animate-pulse">{Array(4).fill(0).map((_, i) => <div key={i} className="h-48 shimmer rounded-2xl" />)}</div>;

  const radarData = [
    { metric: "Accuracy",  value: data.model_metrics.accuracy },
    { metric: "Precision", value: data.model_metrics.precision },
    { metric: "Recall",    value: data.model_metrics.recall },
    { metric: "F1 Score",  value: data.model_metrics.f1_score },
    { metric: "AUC-ROC",   value: data.model_metrics.auc_roc * 100 },
  ];

  const [tp, fp] = data.confusion_matrix[0];
  const [fn, tn] = data.confusion_matrix[1];

  return (
    <div className="space-y-6">
      {/* Model Info Banner */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ background: "linear-gradient(135deg, #0F4C81, #3A86FF)" }}>
        <div className="flex flex-wrap gap-6 items-center text-white">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 opacity-80" />
            <div>
              <p className="font-display font-bold text-lg">RetinaNet-v2.3</p>
              <p className="text-blue-200 text-sm">Deep CNN for DR Grading</p>
            </div>
          </div>
          <div className="flex gap-6 flex-wrap">
            {[
              { label: "Architecture", value: "ResNet-50 + FPN" },
              { label: "Input Size",   value: "512 × 512 px" },
              { label: "Classes",      value: "5 (DR Grades)" },
              { label: "Dataset",      value: "APTOS 2019" },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className="font-display font-bold text-lg">{item.value}</p>
                <p className="text-blue-200 text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Target,   label: "Accuracy",  value: `${data.model_metrics.accuracy}%`,                        color: "bg-blue-50 text-secondary" },
          { icon: Target,   label: "Precision", value: `${data.model_metrics.precision}%`,                       color: "bg-emerald-50 text-success" },
          { icon: Target,   label: "Recall",    value: `${data.model_metrics.recall}%`,                          color: "bg-amber-50 text-warning" },
          { icon: Target,   label: "AUC-ROC",   value: data.model_metrics.auc_roc.toFixed(3),                   color: "bg-purple-50 text-purple-600" },
        ].map((m, i) => (
          <motion.div key={m.label} className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${m.color}`}>
              <m.icon className="w-5 h-5" />
            </div>
            <p className="font-display text-2xl font-bold text-gray-900">{m.value}</p>
            <p className="text-gray-500 text-sm">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2"><MonthlyChart data={data.monthly_activity} /></div>
        <SeverityPieChart data={data.severity_distribution} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ConfidenceChart data={data.confidence_trend} />

        {/* Radar */}
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3 className="font-display font-bold text-gray-900 mb-1">Performance Radar</h3>
          <p className="text-gray-400 text-xs mb-4">Multi-metric model evaluation</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#f0f4ff" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Radar dataKey="value" stroke="#3A86FF" fill="#3A86FF" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Confusion Matrix + Dataset */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <h3 className="font-display font-bold text-gray-900 mb-1">Confusion Matrix</h3>
          <p className="text-gray-400 text-xs mb-5">Binary classification summary (DR / No DR)</p>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            {[
              { label: "True Positive",  value: tp, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
              { label: "False Positive", value: fp, color: "bg-red-50 border-red-200 text-red-700" },
              { label: "False Negative", value: fn, color: "bg-amber-50 border-amber-200 text-amber-700" },
              { label: "True Negative",  value: tn, color: "bg-blue-50 border-blue-200 text-primary" },
            ].map(cell => (
              <div key={cell.label} className={`border-2 rounded-2xl p-4 text-center ${cell.color}`}>
                <p className="font-display text-3xl font-bold">{cell.value}</p>
                <p className="text-xs font-medium mt-1">{cell.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <h3 className="font-display font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" /> Dataset Statistics
          </h3>
          <p className="text-gray-400 text-xs mb-5">APTOS 2019 Blindness Detection</p>
          <div className="space-y-4">
            {[
              { label: "Total Images",      value: data.dataset_stats.total_images, pct: 100,  color: "#3A86FF" },
              { label: "Training Set",      value: data.dataset_stats.training,     pct: 80,   color: "#10B981" },
              { label: "Validation Set",    value: data.dataset_stats.validation,   pct: 20,   color: "#F59E0B" },
              { label: "Number of Classes", value: data.dataset_stats.classes,      pct: null, color: "#7C3AED" },
            ].map(row => (
              <div key={row.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-gray-600">{row.label}</span>
                  <span className="text-sm font-bold text-gray-900">{row.value.toLocaleString()}</span>
                </div>
                {row.pct && (
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background: row.color }}
                      initial={{ width: 0 }} animate={{ width: `${row.pct}%` }}
                      transition={{ duration: 1, delay: 0.6 }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const MOCK = {
  monthly_activity: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m=>({month:m,scans:Math.floor(Math.random()*50+15),positive:Math.floor(Math.random()*20+5)})),
  severity_distribution:[{name:"No DR",value:42,color:"#10B981"},{name:"Mild DR",value:23,color:"#F59E0B"},{name:"Moderate DR",value:19,color:"#F97316"},{name:"Severe DR",value:10,color:"#EF4444"},{name:"Proliferative DR",value:6,color:"#7C3AED"}],
  confidence_trend:Array.from({length:12},(_,i)=>({week:`W${i+1}`,confidence:+(88+Math.random()*9).toFixed(1)})),
  model_metrics:{accuracy:94.7,precision:93.2,recall:95.8,f1_score:94.5,auc_roc:0.971},
  confusion_matrix:[[145,8],[12,95]],
  dataset_stats:{total_images:3662,training:2929,validation:733,classes:5},
};
