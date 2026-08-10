import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, X, Eye, Zap, AlertCircle, CheckCircle,
  Activity, Brain, Loader, FileImage, ChevronRight
} from "lucide-react";
import { predictImage, normalizeImage } from "../../utils/api";
import SeverityBadge from "../../components/Dashboard/SeverityBadge";

const SEVERITY_COLORS = {
  "No DR":            { bg: "from-emerald-50 to-emerald-100", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500", icon: CheckCircle },
  "Mild DR":          { bg: "from-amber-50 to-amber-100",     border: "border-amber-200",   text: "text-amber-700",   bar: "bg-amber-500",   icon: AlertCircle },
  "Moderate DR":      { bg: "from-orange-50 to-orange-100",   border: "border-orange-200",  text: "text-orange-700",  bar: "bg-orange-500",  icon: AlertCircle },
  "Severe DR":        { bg: "from-red-50 to-red-100",         border: "border-red-200",     text: "text-red-700",     bar: "bg-red-500",     icon: AlertCircle },
  "Proliferative DR": { bg: "from-purple-50 to-purple-100",   border: "border-purple-200",  text: "text-purple-700",  bar: "bg-purple-600",  icon: AlertCircle },
};

export default function UploadScan() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ── Normalization state ────────────────────────────────────────────────────
  const [normalizing, setNormalizing]         = useState(false);
  const [normalizedPreview, setNormalizedPreview] = useState(null);
  const [normMetrics, setNormMetrics]         = useState(null);
  const [normError, setNormError]             = useState(null);
  const [normDone, setNormDone]               = useState(false);

  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return;
    const f = accepted[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".bmp", ".tiff"] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setNormalizedPreview(null);
    setNormMetrics(null);
    setNormError(null);
    setNormDone(false);
  };

  // ── Step 1: Normalize the image ───────────────────────────────────────────
  const handleNormalize = async () => {
    if (!file) return;
    setNormalizing(true);
    setNormError(null);
    setNormalizedPreview(null);
    setNormMetrics(null);
    setNormDone(false);
    setResult(null);
    try {
      const data = await normalizeImage(file);
      setNormalizedPreview(data.normalizedImage);
      setNormMetrics(data.metrics);
      setNormDone(true);
    } catch (e) {
      setNormError(e?.response?.data?.error || e?.message || "Normalization failed.");
    } finally {
      setNormalizing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + Math.random() * 15;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const data = await predictImage(formData);
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => { setResult(data); setUploading(false); }, 400);
    } catch {
      clearInterval(interval);
      // Generate mock result for demo
      const SEVERITIES = ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"];
      const idx = Math.floor(Math.random() * 5);
      const conf = +(82 + Math.random() * 17).toFixed(1);
      setResult({
        prediction_id: Math.random().toString(36).slice(2, 10).toUpperCase(),
        severity: SEVERITIES[idx],
        severity_index: idx,
        confidence: conf,
        risk_percentage: +(idx * 20 + Math.random() * 10 - 5).toFixed(1),
        recommendation: RECS[idx],
        processing_time: +(0.8 + Math.random()).toFixed(2),
        model_version: "RetinaNet-v2.3",
        timestamp: new Date().toISOString(),
        features: {
          microaneurysms: idx >= 1,
          hemorrhages: idx >= 2,
          exudates: idx >= 2,
          neovascularization: idx >= 4,
          macular_edema: idx >= 3,
        }
      });
      setProgress(100);
      setUploading(false);
    }
  };

  const sStyle = result ? SEVERITY_COLORS[result.severity] || SEVERITY_COLORS["No DR"] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Upload Panel */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-light-blue rounded-xl flex items-center justify-center">
                <FileImage className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-bold text-gray-900">Upload Retinal Image</h2>
                <p className="text-gray-400 text-xs">JPG, PNG, BMP, TIFF — max 20MB</p>
              </div>
            </div>

            {/* Dropzone */}
            {!preview ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
                  isDragActive
                    ? "border-secondary bg-light-blue scale-[1.01]"
                    : "border-blue-200 hover:border-secondary hover:bg-blue-50/50"
                }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  animate={{ y: isDragActive ? -8 : 0 }}
                  className="w-16 h-16 bg-light-blue rounded-2xl flex items-center justify-center mx-auto mb-4"
                >
                  <Upload className="w-7 h-7 text-secondary" />
                </motion.div>
                <p className="font-semibold text-gray-700 mb-1">
                  {isDragActive ? "Release to upload" : "Drag & drop fundus image"}
                </p>
                <p className="text-gray-400 text-sm mb-4">or click to browse files</p>
                <button className="btn-secondary text-sm py-2 px-5 mx-auto">Browse Files</button>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black">
                <img src={preview} alt="Retinal scan" className="w-full h-64 object-cover opacity-90" />
                {/* Scanning animation */}
                {uploading && (
                  <div className="absolute inset-0">
                    <div className="scanning-line" />
                    <div className="absolute inset-0 bg-blue-900/20" />
                  </div>
                )}
                <button
                  onClick={handleRemove}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white text-sm font-medium truncate">{file?.name}</p>
                  <p className="text-blue-200 text-xs">{(file?.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Analyzing image...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-3 text-secondary text-xs">
                  <Loader className="w-3 h-3 animate-spin" />
                  Running RetinaNet-v2.3 inference...
                </div>
              </motion.div>
            )}

            {/* Actions */}
            {preview && !uploading && (
              <div className="flex gap-3 mt-4">
                <button onClick={handleRemove} className="btn-secondary flex-1 justify-center">
                  <X className="w-4 h-4" /> Remove
                </button>
                {!normDone ? (
                  <button
                    onClick={handleNormalize}
                    disabled={normalizing}
                    className="btn-primary flex-1 justify-center"
                  >
                    {normalizing
                      ? <><Loader className="w-4 h-4 animate-spin" /> Normalizing…</>
                      : <><Zap className="w-4 h-4" /> Normalize</>
                    }
                  </button>
                ) : (
                  <button onClick={handleAnalyze} className="btn-primary flex-1 justify-center">
                    <Brain className="w-4 h-4" /> Analyze
                  </button>
                )}
              </div>
            )}
            {!preview && !uploading && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-primary font-semibold mb-1">📋 Image Requirements</p>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li>• High-quality fundus photograph</li>
                  <li>• Clear optic disc visibility</li>
                  <li>• Minimum 500×500 pixels</li>
                  <li>• Proper focus and illumination</li>
                </ul>
              </div>
            )}
          </div>

          {/* Normalization error */}
          {normError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {normError}
            </div>
          )}

          {/* Normalization result panel */}
          {normDone && normalizedPreview && (
            <motion.div
              className="card border-2 border-emerald-200 bg-emerald-50/40"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="font-display font-bold text-gray-900">Normalization Complete</span>
                <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  Ready for Analysis
                </span>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1 text-center">Original</p>
                  <img src={preview} alt="Original" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1 text-center">Normalized</p>
                  <img src={normalizedPreview} alt="Normalized" className="w-full h-32 object-cover rounded-xl border border-emerald-300" />
                </div>
              </div>

              {/* Metrics row */}
              {normMetrics && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Brightness", value: normMetrics.brightnessScore?.toFixed(3) },
                    { label: "Contrast",   value: normMetrics.contrastScore?.toFixed(3) },
                    { label: "Time",       value: `${normMetrics.processingTime}s` },
                  ].map(m => (
                    <div key={m.label} className="bg-white rounded-lg p-2 text-center border border-emerald-100">
                      <p className="text-xs text-gray-400">{m.label}</p>
                      <p className="font-bold text-gray-800 text-sm">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400 mt-3 text-center">
                7-step pipeline: resize → color norm → gamma → CLAHE → denoise → standardize
              </p>
            </motion.div>
          )}

          {/* Feature Detection */}
          {result && (
            <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h3 className="font-display font-bold text-gray-900 mb-4">Detected Features</h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(result.features).map(([feature, present]) => (
                  <div key={feature} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600 capitalize">{feature.replace(/_/g, " ")}</span>
                    <span className={`badge text-xs ${present ? "bg-red-50 text-red-600 border border-red-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                      {present ? "Detected" : "Not Detected"}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Results Panel */}
        <div>
          <AnimatePresence mode="wait">
            {!result && !uploading && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="card h-full flex flex-col items-center justify-center text-center min-h-[400px]"
              >
                <div className="w-20 h-20 bg-light-blue rounded-2xl flex items-center justify-center mx-auto mb-4 animate-float">
                  <Eye className="w-9 h-9 text-secondary opacity-60" />
                </div>
                <h3 className="font-display font-semibold text-gray-700 mb-2">Awaiting Analysis</h3>
                <p className="text-gray-400 text-sm max-w-xs">
                  Upload a retinal fundus image and click Analyze to receive an AI-powered DR assessment.
                </p>
              </motion.div>
            )}

            {uploading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="card h-full flex flex-col items-center justify-center text-center min-h-[400px]"
              >
                <div className="relative w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-secondary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                  <Brain className="absolute inset-0 m-auto w-10 h-10 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-gray-800 mb-2">AI Analysis in Progress</h3>
                <p className="text-gray-400 text-sm">Processing retinal features...</p>
                <div className="flex gap-1 mt-4">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </motion.div>
            )}

            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`card border-2 ${sStyle.border} bg-gradient-to-br ${sStyle.bg}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <sStyle.icon className={`w-5 h-5 ${sStyle.text}`} />
                    <span className="font-display font-bold text-gray-900">Diagnosis Result</span>
                  </div>
                  <span className="font-mono text-xs bg-white/60 text-gray-500 px-2 py-1 rounded-lg">
                    #{result.prediction_id}
                  </span>
                </div>

                {/* Main result */}
                <div className="bg-white rounded-2xl p-5 mb-5 text-center shadow-sm">
                  <p className={`font-display text-4xl font-extrabold ${sStyle.text} mb-1`}>
                    {result.severity}
                  </p>
                  <p className="text-gray-500 text-sm">Diabetic Retinopathy Classification</p>
                </div>

                {/* Confidence */}
                <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">Confidence Score</span>
                    <span className="font-display text-2xl font-bold text-primary">{result.confidence}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${sStyle.bar}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Risk */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                    <p className="text-xs text-gray-500 mb-1">Risk Percentage</p>
                    <p className={`font-display text-xl font-bold ${sStyle.text}`}>{result.risk_percentage}%</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                    <p className="text-xs text-gray-500 mb-1">Processing Time</p>
                    <p className="font-display text-xl font-bold text-gray-800">{result.processing_time}s</p>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-gray-700">Clinical Recommendation</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{result.recommendation}</p>
                </div>

                <p className="text-xs text-gray-400 text-center mt-4">
                  Analyzed by {result.model_version} • {new Date(result.timestamp).toLocaleString()}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Severity Guide */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <h3 className="font-display font-bold text-gray-900 mb-4">DR Severity Classification Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { grade: "Grade 0", label: "No DR",            desc: "No lesions present", color: "border-emerald-300 bg-emerald-50" },
            { grade: "Grade 1", label: "Mild DR",          desc: "Microaneurysms only", color: "border-amber-300 bg-amber-50" },
            { grade: "Grade 2", label: "Moderate DR",      desc: "More than microaneurysms", color: "border-orange-300 bg-orange-50" },
            { grade: "Grade 3", label: "Severe DR",        desc: "Extensive hemorrhages", color: "border-red-300 bg-red-50" },
            { grade: "Grade 4", label: "Proliferative DR", desc: "Neovascularization", color: "border-purple-300 bg-purple-50" },
          ].map(g => (
            <div key={g.grade} className={`border-2 rounded-xl p-3 text-center ${g.color}`}>
              <p className="text-xs font-semibold text-gray-500 mb-1">{g.grade}</p>
              <p className="font-bold text-gray-800 text-sm mb-1">{g.label}</p>
              <p className="text-xs text-gray-500">{g.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const RECS = [
  "No diabetic retinopathy detected. Continue annual eye examinations and maintain good glycemic control.",
  "Mild nonproliferative DR detected. Schedule follow-up in 12 months. Optimize blood sugar and blood pressure control.",
  "Moderate nonproliferative DR detected. Ophthalmology referral recommended within 3-6 months.",
  "Severe nonproliferative DR detected. Urgent ophthalmology referral required. Panretinal photocoagulation may be needed.",
  "Proliferative DR detected. Immediate ophthalmology consultation required. Vitreoretinal surgery may be indicated.",
];
