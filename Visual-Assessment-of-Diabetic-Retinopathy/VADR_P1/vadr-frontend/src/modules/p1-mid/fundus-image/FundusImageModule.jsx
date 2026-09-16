import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Eye, ZoomIn, ZoomOut, RotateCcw, Sun, Contrast,
  Pencil, Circle, Square, Minus, Trash2, Download,
  Brain, Activity, AlertTriangle, CheckCircle, Info,
  RefreshCw, Maximize2
} from "lucide-react";
import "./vadr-fundus.css";
import { BASE_URL, predictAPI } from "../../../api";


// ─── Constants ────────────────────────────────────────────────────────────────
const DR_GRADES = [
  { id: 0, label: "No DR",          emoji: "✅", desc: "No signs of diabetic retinopathy detected." },
  { id: 1, label: "Mild",           emoji: "🔵", desc: "Minor microaneurysms present." },
  { id: 2, label: "Moderate",       emoji: "🟡", desc: "More than mild NPDR. Referral recommended." },
  { id: 3, label: "Severe",         emoji: "🔴", desc: "Significant retinal damage. Urgent referral." },
  { id: 4, label: "Proliferative DR", emoji: "🟣", desc: "Advanced stage. Immediate intervention required." },
];

const ANNOTATION_TOOLS = [
  { id: "pen",    label: "Pen",    Icon: Pencil  },
  { id: "circle", label: "Circle", Icon: Circle  },
  { id: "rect",   label: "Rect",   Icon: Square  },
  { id: "line",   label: "Line",   Icon: Minus   },
];

// ─── Quality check (basic heuristic on image dimensions + file size) ──────────
function checkImageQuality(file, img) {
  const size = file.size / 1024; // KB
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const minDim = Math.min(w, h);
  if (minDim >= 512 && size > 30) return { score: 92, level: "good", msg: "Image quality looks excellent for analysis." };
  if (minDim >= 256 && size > 10) return { score: 68, level: "warn", msg: "Acceptable quality. Higher resolution improves accuracy." };
  return { score: 35, level: "bad",  msg: "Low resolution. Please upload a higher-quality fundus image." };
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function getCanvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FundusImageModule() {
  // Upload
  const [file, setFile]               = useState(null);
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [eye, setEye]                 = useState("L");
  const fileInputRef                  = useRef();

  // Quality
  const [quality, setQuality]         = useState(null);

  // Zoom / adjust
  const [zoom, setZoom]               = useState(100);
  const [brightness, setBrightness]   = useState(100);
  const [contrast, setContrast]       = useState(100);

  // Annotation
  const [annoTool, setAnnoTool]       = useState("pen");
  const [annoColor, setAnnoColor]     = useState("#ef4444");
  const canvasRef                     = useRef();
  const drawing                       = useRef(false);
  const startPos                      = useRef({ x: 0, y: 0 });
  const snapshot                      = useRef(null);

  // Eye viewer slots
  const [eyeSlots, setEyeSlots]       = useState({ L: null, R: null });

  // Analysis
  const [analyzing, setAnalyzing]     = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);

  // ── File handling ─────────────────────────────────────────────────────────
  const acceptFile = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setResult(null);
    setError(null);
    setQuality(null);
    setZoom(100);
    setBrightness(100);
    setContrast(100);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  }, [acceptFile]);

  const onFileChange = (e) => acceptFile(e.target.files[0]);

  // Cleanup object URLs
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // ── Quality check on image load ───────────────────────────────────────────
  const onImgLoad = useCallback((e) => {
    if (!file) return;
    setQuality(checkImageQuality(file, e.target));
    // init canvas
    const img = e.target;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.height = `${img.clientHeight}px`;
    }
  }, [file]);

  // ── Annotation drawing ─────────────────────────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext("2d");

  const onMouseDown = (e) => {
    if (!file) return;
    drawing.current = true;
    const ctx = getCtx();
    const pos = getCanvasPos(canvasRef.current, e);
    startPos.current = pos;
    snapshot.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.strokeStyle = annoColor;
    ctx.fillStyle   = annoColor;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    if (annoTool === "pen") { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
  };

  const onMouseMove = (e) => {
    if (!drawing.current) return;
    const ctx = getCtx();
    const pos = getCanvasPos(canvasRef.current, e);
    if (annoTool === "pen") {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.putImageData(snapshot.current, 0, 0);
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      ctx.beginPath();
      if (annoTool === "rect")   ctx.strokeRect(startPos.current.x, startPos.current.y, dx, dy);
      if (annoTool === "circle") ctx.arc(startPos.current.x, startPos.current.y, Math.sqrt(dx*dx+dy*dy), 0, Math.PI*2);
      if (annoTool === "line")   { ctx.moveTo(startPos.current.x, startPos.current.y); ctx.lineTo(pos.x, pos.y); }
      ctx.stroke();
    }
  };

  const onMouseUp = () => { drawing.current = false; };

  const clearAnnotations = () => {
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // ── Assign to eye slot ─────────────────────────────────────────────────────
  const assignToSlot = (side) => {
    if (!previewUrl) return;
    setEyeSlots(prev => ({ ...prev, [side]: previewUrl }));
  };

  // ── Analyze (call /api/predict via predictAPI) ─────────────────────────────
  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const data = await predictAPI.analyze(file);
      setResult(data);
      // auto-assign uploaded image to current eye slot
      setEyeSlots(prev => ({ ...prev, [eye]: previewUrl }));
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setQuality(null);
    setZoom(100);
    setBrightness(100);
    setContrast(100);
    clearAnnotations();
  };

  // ─── Grade info ─────────────────────────────────────────────────────────────
  const gradeInfo = result ? DR_GRADES.find(g => g.id === result.class_id) || DR_GRADES[0] : null;

  // ─── GradCAM URL ────────────────────────────────────────────────────────────
  // Backend returns a path like "uploads/gradcam/xxx.png"
  // We serve it via /api/gradcam-image?path=…
  const gradcamUrl = result?.gradcam
    ? `${BASE_URL}/gradcam-image?path=${encodeURIComponent(result.gradcam)}`
    : null;

  // ── Image filter style ─────────────────────────────────────────────────────
  const imgStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
    transform: `scale(${zoom / 100})`,
    transformOrigin: "center",
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fih-root">
      {/* Header */}
      <div className="fih-header">
        <div className="fih-header-left">
          <h2>Fundus Image Analysis</h2>
          <p>Upload a retinal fundus photograph and run AI-powered diabetic retinopathy screening.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="fih-header-badge">
            <Brain size={12} /> AI-Powered · EfficientNetB3
          </span>
          {file && (
            <button className="fih-reset-btn" onClick={reset}>
              <RefreshCw size={13} /> New Analysis
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="fih-grid">

        {/* ── Left: Upload + Controls ─────────────────────────────────────── */}
        <div className="fih-card">
          <div className="fih-card-header">
            <div className="fih-card-title">
              <div className="fih-card-title-icon"><Upload size={14} /></div>
              Fundus Image Upload
            </div>
            {file && (
              <div className="fih-info-chips" style={{ margin: 0 }}>
                <span className="fih-chip fih-chip--eye">👁 {eye === "L" ? "Left Eye" : "Right Eye"}</span>
                <span className="fih-chip">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
            )}
          </div>
          <div className="fih-card-body">

            {/* Drop zone */}
            <div
              className={`fih-drop-zone ${isDragging ? "fih-drop-zone--active" : ""} ${file ? "fih-drop-zone--has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onFileChange}
              />

              {file && previewUrl ? (
                <div className="fih-canvas-wrap fih-preview-wrap">
                  <img
                    src={previewUrl}
                    alt="Fundus preview"
                    className="fih-preview-img"
                    style={imgStyle}
                    onLoad={onImgLoad}
                    draggable={false}
                  />
                  {/* Annotation canvas overlay */}
                  <canvas
                    ref={canvasRef}
                    className="fih-annotation-canvas"
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                  />
                  {/* Scanning animation while analyzing */}
                  {analyzing && (
                    <div className="fih-scanning-overlay">
                      <div className="fih-scanning-line" />
                      <div className="fih-scanning-text">⚡ Analyzing…</div>
                    </div>
                  )}
                  <button
                    className="fih-preview-remove"
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    title="Remove image"
                  >✕</button>
                </div>
              ) : (
                <>
                  <div className="fih-drop-icon"><Upload size={26} /></div>
                  <p className="fih-drop-title">Drag & drop fundus image here</p>
                  <p className="fih-drop-sub">or click to browse files</p>
                  <div className="fih-drop-formats">
                    {["JPG", "PNG", "TIFF", "BMP"].map(f => (
                      <span key={f} className="fih-format-pill">{f}</span>
                    ))}
                  </div>
                  <button className="fih-drop-browse" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    Browse Files
                  </button>
                </>
              )}
            </div>

            {/* Quality badge */}
            {quality && (
              <div className={`fih-quality-bar fih-quality-bar--${quality.level}`}>
                {quality.level === "good" && <CheckCircle size={15} />}
                {quality.level === "warn" && <AlertTriangle size={15} />}
                {quality.level === "bad"  && <AlertTriangle size={15} />}
                <span>{quality.msg}</span>
                <span className="fih-quality-score">{quality.score}<small style={{ fontSize: 11 }}>/100</small></span>
              </div>
            )}

            {/* Eye selector */}
            <div className="fih-eye-selector">
              {["L", "R"].map(side => (
                <button
                  key={side}
                  className={`fih-eye-btn ${eye === side ? "fih-eye-btn--active" : ""}`}
                  onClick={() => setEye(side)}
                >
                  <span className="fih-eye-icon">{side === "L" ? "👁" : "👁"}</span>
                  {side === "L" ? "Left Eye" : "Right Eye"}
                </button>
              ))}
            </div>

            {/* Zoom + adjust controls */}
            {file && (
              <>
                <div className="fih-controls">
                  <span className="fih-control-label">Zoom</span>
                  <button className="fih-control-btn" onClick={() => setZoom(z => Math.max(50, z - 10))} disabled={zoom <= 50}>
                    <ZoomOut size={14} />
                  </button>
                  <span className="fih-zoom-level">{zoom}%</span>
                  <button className="fih-control-btn" onClick={() => setZoom(z => Math.min(300, z + 10))} disabled={zoom >= 300}>
                    <ZoomIn size={14} />
                  </button>
                  <button className="fih-control-btn" onClick={() => setZoom(100)} title="Reset zoom">
                    <Maximize2 size={14} />
                  </button>
                  <div className="fih-control-sep" />
                  <button className="fih-control-btn" onClick={() => { setBrightness(100); setContrast(100); }} title="Reset adjustments">
                    <RotateCcw size={14} />
                  </button>
                </div>

                <div className="fih-slider-group">
                  <div className="fih-slider-row">
                    <label><Sun size={11} style={{ verticalAlign: "middle" }} /> Brightness</label>
                    <input type="range" min={50} max={200} value={brightness} onChange={e => setBrightness(+e.target.value)} />
                    <span className="fih-slider-val">{brightness}%</span>
                  </div>
                  <div className="fih-slider-row">
                    <label><Contrast size={11} style={{ verticalAlign: "middle" }} /> Contrast</label>
                    <input type="range" min={50} max={200} value={contrast} onChange={e => setContrast(+e.target.value)} />
                    <span className="fih-slider-val">{contrast}%</span>
                  </div>
                </div>

                {/* Annotation toolbar */}
                <div className="fih-annotation-toolbar">
                  {ANNOTATION_TOOLS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      className={`fih-anno-btn ${annoTool === id ? "fih-anno-btn--active" : ""}`}
                      onClick={() => setAnnoTool(id)}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                  <div className="fih-anno-sep" />
                  <label className="fih-anno-color" title="Pen colour" style={{ background: annoColor }}>
                    <input type="color" value={annoColor} onChange={e => setAnnoColor(e.target.value)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                  </label>
                  <div className="fih-anno-sep" />
                  <button className="fih-anno-btn" onClick={clearAnnotations} title="Clear all annotations">
                    <Trash2 size={12} /> Clear
                  </button>
                  <button className="fih-anno-btn" onClick={() => assignToSlot(eye)} title="Assign to eye slot">
                    <Eye size={12} /> Assign to {eye === "L" ? "Left" : "Right"}
                  </button>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 14, padding: "12px 14px", borderRadius: 10,
                background: "var(--vadr-error-bg)", border: "1px solid var(--vadr-error-border)",
                color: "var(--vadr-error-text)", fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8
              }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            {/* Analyze button */}
            <button
              className="fih-analyze-btn"
              onClick={analyze}
              disabled={!file || analyzing}
            >
              {analyzing ? (
                <><div className="fih-spinner" /> Analyzing Fundus Image…</>
              ) : (
                <><Brain size={18} /> Run AI Analysis</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right: Results ─────────────────────────────────────────────── */}
        <div className="fih-card">
          <div className="fih-card-header">
            <div className="fih-card-title">
              <div className="fih-card-title-icon"><Activity size={14} /></div>
              AI Analysis Results
            </div>
            {result && (
              <span style={{ fontSize: 11, color: "var(--vadr-success-text)", fontWeight: 700 }}>
                ✓ Analysis Complete
              </span>
            )}
          </div>
          <div className="fih-card-body">
            {!result ? (
              <div className="fih-empty-results">
                <div className="fih-empty-icon"><Brain size={28} /></div>
                <p className="fih-empty-title">No Results Yet</p>
                <p className="fih-empty-sub">
                  Upload a fundus image and click "Run AI Analysis" to see the diabetic retinopathy assessment.
                </p>
                {/* DR severity legend */}
                <div className="fih-severity-legend">
                  {DR_GRADES.map(g => (
                    <span key={g.id} className="fih-severity-item">
                      <span className={`fih-severity-dot fih-severity-dot--${g.id}`} />
                      {g.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="fih-results">
                {/* Hero result */}
                <div className="fih-result-hero">
                  <div className={`fih-result-grade fih-result-grade--${result.class_id}`}>
                    {result.class_id}
                  </div>
                  <div>
                    <div className="fih-result-label">DR Grade · {eye === "L" ? "Left" : "Right"} Eye</div>
                    <div className="fih-result-prediction">{result.prediction}</div>
                    <div className="fih-result-confidence">
                      Confidence: <span>{result.confidence}%</span>
                    </div>
                    {gradeInfo && (
                      <div style={{ fontSize: 12, color: "var(--vadr-text-muted)", marginTop: 6 }}>
                        <Info size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                        {gradeInfo.desc}
                      </div>
                    )}
                  </div>
                </div>

                {/* Probability bars */}
                <div style={{ marginBottom: 6, fontWeight: 700, fontSize: 12, color: "var(--vadr-text-muted)" }}>
                  Class Probabilities
                </div>
                <div className="fih-prob-list">
                  {Object.entries(result.probabilities).map(([name, pct], i) => (
                    <div key={name} className="fih-prob-row">
                      <div className="fih-prob-meta">
                        <span className="fih-prob-name">{name}</span>
                        <span className="fih-prob-pct">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="fih-prob-track">
                        <div
                          className={`fih-prob-fill fih-prob-fill--${i}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* GradCAM */}
                {gradcamUrl && (
                  <>
                    <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 12, color: "var(--vadr-text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>GradCAM Heatmap</span>
                      <a
                        href={gradcamUrl}
                        download="gradcam.png"
                        className="fih-dl-btn"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={11} /> Download
                      </a>
                    </div>
                    <div className="fih-gradcam-wrap">
                      <img src={gradcamUrl} alt="GradCAM heatmap" className="fih-gradcam-img" />
                      <div className="fih-gradcam-caption">
                        <Activity size={11} />
                        Gradient-weighted Class Activation Map — highlights regions influencing the prediction
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom full-width: Left/Right Eye Viewer ───────────────────── */}
        <div className="fih-card fih-full-width">
          <div className="fih-card-header">
            <div className="fih-card-title">
              <div className="fih-card-title-icon"><Eye size={14} /></div>
              Left / Right Eye Viewer
            </div>
            <span style={{ fontSize: 11, color: "var(--vadr-text-muted)" }}>
              Use "Assign" in the toolbar above to populate each slot
            </span>
          </div>
          <div className="fih-card-body">
            <div className="fih-viewer-grid">
              {["L", "R"].map(side => (
                <div key={side} className="fih-viewer-slot">
                  <div className="fih-viewer-slot-header">
                    <div className={`fih-viewer-slot-eye fih-viewer-slot-eye--${side}`}>{side}</div>
                    <span className="fih-viewer-slot-label">{side === "L" ? "Left Eye" : "Right Eye"}</span>
                    {eyeSlots[side] && (
                      <button
                        style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "var(--vadr-text-faint)", fontSize: 11, fontFamily: "inherit" }}
                        onClick={() => setEyeSlots(prev => ({ ...prev, [side]: null }))}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="fih-viewer-slot-body">
                    {eyeSlots[side] ? (
                      <img src={eyeSlots[side]} alt={`${side === "L" ? "Left" : "Right"} eye fundus`} className="fih-viewer-img" />
                    ) : (
                      <div className="fih-viewer-empty">
                        <span className="fih-viewer-empty-icon">👁</span>
                        <span>No image assigned</span>
                        {previewUrl && (
                          <button className="fih-viewer-assign-btn" onClick={() => assignToSlot(side)}>
                            Assign current image
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>{/* /fih-grid */}
    </div>
  );
}
