import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Camera, Clock, CheckCircle2, AlertTriangle, Upload,
  ChevronDown, RefreshCw, User, Eye, Play,
  Activity, TrendingUp, Award, Zap, X, Check,
  FileImage, Brain, Layers
} from "lucide-react";
import api, { normalizeImage } from "../../utils/api";

const SEV_COLOR  = ["#10B981","#F59E0B","#F97316","#EF4444","#7C3AED"];
const SEV_LABELS = ["No DR","Mild DR","Moderate DR","Severe DR","Proliferative DR"];
const PRI_COLOR  = { High:"#EF4444", Medium:"#F59E0B", Low:"#10B981" };
const PRI_BG     = { High:"#FEF2F2", Medium:"#FFFBEB", Low:"#ECFDF5" };
const STATUS_COLOR = { pending:"#F59E0B","in-progress":"#3A86FF",completed:"#10B981" };
const STATUS_BG    = { pending:"#FFFBEB","in-progress":"#EAF4FF",completed:"#ECFDF5" };

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>{children}</div>
);
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <Card className="p-5">
    <div className="flex items-center gap-3 mb-3">
      <div style={{ width:42,height:42,borderRadius:12,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
        <Icon size={20} style={{ color }} />
      </div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
    <p style={{ fontSize:28,fontWeight:800,color:"#1E293B",lineHeight:1 }}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
  </Card>
);

const ScanTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:"10px 14px",boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
      <p style={{ fontSize:11,color:"#94A3B8" }}>{payload[0].payload.day}</p>
      <p style={{ fontSize:15,fontWeight:700,color:"#0F4C81" }}>{payload[0].value} scans</p>
    </div>
  );
};

// ─── Retinal image upload for scan modal ─────────────────────────────────────
function ScanUploadZone({ file, preview, onChange, onClear }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);

  const handleFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 20 * 1024 * 1024) return;
    onChange(f);
  };

  return (
    <div
      onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onClick={() => !file && inputRef.current?.click()}
      style={{
        border:`2px dashed ${drag?"#3A86FF":file?"#10B981":"#CBD5E1"}`,
        borderRadius:14, padding: file ? 10 : 22, textAlign:"center",
        background: drag?"#EAF4FF": file?"#F0FDF4":"#F8FAFC",
        cursor: file?"default":"pointer", transition:"all 0.2s ease",
      }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
        onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
      {!file ? (
        <>
          <div style={{ width:44,height:44,borderRadius:12,background:"#EAF4FF",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px" }}>
            <FileImage size={20} style={{ color:"#3A86FF" }} />
          </div>
          <p style={{ fontSize:13,fontWeight:600,color:"#334155",marginBottom:4 }}>Drop retinal image here</p>
          <p style={{ fontSize:11,color:"#94A3B8",marginBottom:10 }}>JPG, PNG, BMP, TIFF · max 20 MB</p>
          <span style={{ fontSize:11,fontWeight:600,color:"#3A86FF",background:"#EAF4FF",padding:"5px 14px",borderRadius:99 }}>Browse Files</span>
        </>
      ) : (
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <img src={preview} alt="preview" style={{ width:64,height:64,borderRadius:10,objectFit:"cover",border:"2px solid #10B981",flexShrink:0 }} />
          <div style={{ flex:1,textAlign:"left" }}>
            <p style={{ fontSize:12,fontWeight:600,color:"#1E293B" }}>{file.name}</p>
            <p style={{ fontSize:10,color:"#94A3B8" }}>{(file.size/1024/1024).toFixed(2)} MB · ✓ Ready</p>
          </div>
          <button onClick={e => { e.stopPropagation(); onClear(); }}
            style={{ background:"#FEF2F2",border:"none",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
            <X size={12} style={{ color:"#EF4444" }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Scan Processing Modal — Normalization Module ─────────────────────────────
function ScanModal({ queueItem, techId, onClose, onSuccess }) {
  const [file, setFile]                   = useState(null);
  const [preview, setPreview]             = useState(null);
  const [eye, setEye]                     = useState("Right Eye");
  const [loading, setLoading]             = useState(false);
  const [normalizedImage, setNormalizedImage] = useState(null);
  const [metrics, setMetrics]             = useState(null);
  const [error, setError]                 = useState(null);

  const handleFileChange = (f) => { setFile(f); setPreview(URL.createObjectURL(f)); setError(null); setNormalizedImage(null); setMetrics(null); };

  const handleNormalize = async () => {
    if (!file) { setError("Please upload a retinal image before processing."); return; }
    setLoading(true); setError(null);
    try {
      const data = await normalizeImage(file);
      setNormalizedImage(data.normalizedImage);
      setMetrics(data.metrics);
      onSuccess && onSuccess();
    } catch(e) {
      setError(e?.response?.data?.error || e?.message || "Normalization failed. Ensure Flask backend is running.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20 }}
      onClick={e => { if (e.target===e.currentTarget && !loading) onClose(); }}>
      <div style={{ background:"#fff",borderRadius:22,width:"100%",maxWidth:520,boxShadow:"0 24px 80px rgba(0,0,0,0.22)",overflow:"hidden",maxHeight:"90vh",overflowY:"auto" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#0F4C81,#1a5c96)",padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div>
            <p style={{ fontSize:16,fontWeight:800,color:"#fff" }}>Normalize Retinal Scan</p>
            <p style={{ fontSize:12,color:"rgba(255,255,255,0.65)" }}>{queueItem.patient_name} · {queueItem.patient_id}</p>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff" }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ padding:24 }}>
          {/* Patient info */}
          <div style={{ background:"#F8FAFC",borderRadius:12,padding:"12px 14px",marginBottom:18,display:"flex",gap:20,flexWrap:"wrap" }}>
            {[["Patient",queueItem.patient_name],["Age",`${queueItem.patient_age} yrs`],["HbA1c",`${queueItem.hba1c}%`],["Last Scan",queueItem.last_scan]].map(([l,v]) => (
              <div key={l}><p style={{ fontSize:10,color:"#94A3B8",marginBottom:2 }}>{l}</p><p style={{ fontSize:12,fontWeight:700,color:"#1E293B" }}>{v}</p></div>
            ))}
          </div>

          {/* Eye selector */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5 }}>Eye Being Scanned</label>
            <div style={{ display:"flex",gap:8 }}>
              {["Right Eye","Left Eye"].map(opt => (
                <button key={opt} onClick={() => setEye(opt)}
                  style={{ flex:1,padding:"8px",borderRadius:10,border:`1.5px solid ${eye===opt?"#0F4C81":"#E2E8F0"}`,background:eye===opt?"#EAF4FF":"#fff",fontSize:12,fontWeight:600,color:eye===opt?"#0F4C81":"#64748B",cursor:"pointer" }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Upload zone */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:6 }}>Retinal Fundus Image *</label>
            <ScanUploadZone file={file} preview={preview} onChange={handleFileChange} onClear={() => { setFile(null); setPreview(null); setNormalizedImage(null); setMetrics(null); }} />
          </div>

          {error && <p style={{ fontSize:12,color:"#EF4444",background:"#FEF2F2",borderRadius:10,padding:"8px 12px",marginBottom:14 }}>⚠ {error}</p>}

          {/* Normalize button */}
          {!normalizedImage && (
            <button onClick={handleNormalize} disabled={loading||!file}
              style={{ width:"100%",background:loading||!file?"#94A3B8":"#0F4C81",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:14,fontWeight:700,cursor:loading||!file?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8 }}>
              {loading
                ? <><div style={{ width:18,height:18,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite" }} />Normalizing image…</>
                : <><Activity size={16} />Normalize Image</>}
            </button>
          )}

          {/* Normalization result */}
          {normalizedImage && (
            <div style={{ marginTop:4 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                <CheckCircle2 size={18} style={{ color:"#10B981" }}/>
                <p style={{ fontSize:13,fontWeight:700,color:"#1E293B" }}>Normalization Complete — {eye}</p>
                <span style={{ marginLeft:"auto",fontSize:10,fontWeight:600,background:"#ECFDF5",color:"#059669",padding:"3px 10px",borderRadius:99 }}>Done</span>
              </div>

              {/* Before / After */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:5 }}>ORIGINAL</p>
                  <img src={preview} alt="original" style={{ width:"100%",height:120,objectFit:"cover",borderRadius:10,border:"1.5px solid #E2E8F0" }}/>
                </div>
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:10,color:"#059669",fontWeight:600,marginBottom:5 }}>NORMALIZED</p>
                  <img src={normalizedImage} alt="normalized" style={{ width:"100%",height:120,objectFit:"cover",borderRadius:10,border:"1.5px solid #10B981" }}/>
                </div>
              </div>

              {/* Metrics */}
              {metrics && (
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14 }}>
                  {[["Brightness",metrics.brightnessScore?.toFixed(3)],["Contrast",metrics.contrastScore?.toFixed(3)],["Time",`${metrics.processingTime}s`]].map(([l,v])=>(
                    <div key={l} style={{ background:"#F8FAFC",borderRadius:10,padding:"8px",textAlign:"center",border:"1px solid #E2E8F0" }}>
                      <p style={{ fontSize:10,color:"#94A3B8" }}>{l}</p>
                      <p style={{ fontSize:13,fontWeight:800,color:"#1E293B" }}>{v}</p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:"flex",gap:10 }}>
                <button onClick={onClose} style={{ flex:1,background:"#10B981",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  <Check size={15} /> Done
                </button>
                <button onClick={() => { setNormalizedImage(null); setMetrics(null); setFile(null); setPreview(null); }}
                  style={{ flex:1,background:"#F1F5F9",color:"#334155",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                  Scan Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Standalone Upload Component (outside the queue modal) ───────────────────
function StandaloneUpload({ techId, queue, onUpdateStatus, onOpenModal, onScanDone }) {
  const [open,            setOpen]            = useState(false);
  const [file,            setFile]            = useState(null);
  const [preview,         setPreview]         = useState(null);
  const [patient,         setPatient]         = useState("");
  const [eye,             setEye]             = useState("Right Eye");
  const [drag,            setDrag]            = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [normalizedImage, setNormalizedImage] = useState(null);
  const [metrics,         setMetrics]         = useState(null);
  const [error,           setError]           = useState(null);
  const inputRef = useRef();

  const pendingQ = queue.filter(q=>q.status!=="completed");

  const handleFile=(f)=>{ if(!f||!f.type.startsWith("image/")) return; setFile(f); setPreview(URL.createObjectURL(f)); setNormalizedImage(null); setMetrics(null); setError(null); };
  const reset=()=>{ setFile(null); setPreview(null); setNormalizedImage(null); setMetrics(null); setError(null); };

  const handleNormalize=async()=>{
    if(!file){ setError("Please upload a retinal image first."); return; }
    setLoading(true); setError(null);
    try{
      const data = await normalizeImage(file);
      setNormalizedImage(data.normalizedImage);
      setMetrics(data.metrics);
      onScanDone&&onScanDone();
    } catch(e){ setError(e?.response?.data?.error||e?.message||"Normalization failed. Check Flask backend."); }
    finally{ setLoading(false); }
  };

  return (
    <div style={{border:"1.5px solid #CBD5E1",borderRadius:20,overflow:"hidden",background:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
      {/* Toggle Header */}
      <button onClick={()=>{ setOpen(v=>!v); reset(); }}
        style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"16px 20px",background:open?"#EAF4FF":"#fff",border:"none",cursor:"pointer",textAlign:"left",transition:"background 0.2s"}}>
        <div style={{width:42,height:42,borderRadius:12,background:open?"#3A86FF":"#EAF4FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.2s"}}>
          <Upload size={20} style={{color:open?"#fff":"#3A86FF"}}/>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:15,fontWeight:700,color:"#1E293B",marginBottom:2}}>Upload Retinal Image</p>
          <p style={{fontSize:12,color:"#64748B"}}>Directly upload and analyse a fundus photograph without assigning to a queue item</p>
        </div>
        <div style={{background:open?"#3A86FF":"#F1F5F9",color:open?"#fff":"#64748B",borderRadius:10,padding:"5px 14px",fontSize:12,fontWeight:600,flexShrink:0}}>
          {open?"▲ Close":"▼ Open"}
        </div>
      </button>

      {/* Upload Panel */}
      {open&&(
        <div style={{padding:"20px 24px",borderTop:"1px solid #E2E8F0",background:"#FAFBFC"}}>
          {!normalizedImage ? (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
              {/* Left: Drop zone */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:6}}>Retinal Fundus Image *</label>
                <div
                  onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
                  onDragOver={e=>{e.preventDefault();setDrag(true);}}
                  onDragLeave={()=>setDrag(false)}
                  onClick={()=>!file&&inputRef.current?.click()}
                  style={{border:`2px dashed ${drag?"#3A86FF":file?"#10B981":"#CBD5E1"}`,borderRadius:14,padding:file?12:30,textAlign:"center",background:drag?"#EAF4FF":file?"#F0FDF4":"#fff",cursor:file?"default":"pointer",transition:"all 0.2s"}}>
                  <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); }}/>
                  {!file?(
                    <>
                      <div style={{width:48,height:48,borderRadius:14,background:"#EAF4FF",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><FileImage size={22} style={{color:"#3A86FF"}}/></div>
                      <p style={{fontSize:13,fontWeight:600,color:"#334155",marginBottom:4}}>Drop retinal image here</p>
                      <p style={{fontSize:11,color:"#94A3B8",marginBottom:10}}>JPG, PNG, BMP, TIFF · max 20 MB</p>
                      <span style={{fontSize:11,fontWeight:600,color:"#3A86FF",background:"#EAF4FF",padding:"5px 14px",borderRadius:99}}>Browse Files</span>
                    </>
                  ):(
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <img src={preview} alt="preview" style={{width:60,height:60,borderRadius:10,objectFit:"cover",border:"2px solid #10B981",flexShrink:0}}/>
                      <div style={{flex:1,textAlign:"left"}}>
                        <p style={{fontSize:12,fontWeight:600,color:"#1E293B"}}>{file.name}</p>
                        <p style={{fontSize:10,color:"#94A3B8"}}>{(file.size/1024/1024).toFixed(2)} MB · ✓ Ready</p>
                      </div>
                      <button onClick={e=>{e.stopPropagation();reset();}} style={{background:"#FEF2F2",border:"none",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={12} style={{color:"#EF4444"}}/></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Options */}
              <div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:6}}>Assign to Patient (optional)</label>
                  <select value={patient} onChange={e=>setPatient(e.target.value)} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",background:"#fff"}}>
                    <option value="">— Select from queue —</option>
                    {pendingQ.map(q=><option key={q.id||q._id} value={q.patient_id}>{q.patient_name} ({q.priority} priority)</option>)}
                  </select>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:6}}>Eye Being Scanned</label>
                  <div style={{display:"flex",gap:8}}>
                    {["Right Eye","Left Eye"].map(opt=>(
                      <button key={opt} onClick={()=>setEye(opt)} style={{flex:1,padding:"9px",borderRadius:10,border:`1.5px solid ${eye===opt?"#3A86FF":"#E2E8F0"}`,background:eye===opt?"#EAF4FF":"#fff",fontSize:12,fontWeight:600,color:eye===opt?"#3A86FF":"#64748B",cursor:"pointer"}}>{opt}</button>
                    ))}
                  </div>
                </div>
                {error&&<p style={{fontSize:12,color:"#EF4444",background:"#FEF2F2",borderRadius:10,padding:"8px 12px",marginBottom:12}}>⚠ {error}</p>}
                {!normalizedImage && (
                  <button onClick={handleNormalize} disabled={!file||loading}
                    style={{width:"100%",background:!file||loading?"#94A3B8":"#0F4C81",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:!file||loading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    {loading?<><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite"}}/>Normalizing…</>:<><Activity size={15}/>Normalize Image</>}
                  </button>
                )}
                {!file&&<p style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginTop:8}}>Upload an image above to normalize</p>}
              </div>
            </div>
          ): null}

          {/* Normalization Result */}
          {normalizedImage && (
            <div style={{marginTop:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <CheckCircle2 size={18} style={{color:"#10B981"}}/>
                <p style={{fontSize:13,fontWeight:700,color:"#1E293B"}}>Normalization Complete — {eye}</p>
                <span style={{marginLeft:"auto",fontSize:10,fontWeight:600,background:"#ECFDF5",color:"#059669",padding:"3px 10px",borderRadius:99}}>Done</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div style={{textAlign:"center"}}>
                  <p style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:5}}>ORIGINAL</p>
                  <img src={preview} alt="original" style={{width:"100%",height:120,objectFit:"cover",borderRadius:10,border:"1.5px solid #E2E8F0"}}/>
                </div>
                <div style={{textAlign:"center"}}>
                  <p style={{fontSize:10,color:"#059669",fontWeight:600,marginBottom:5}}>NORMALIZED</p>
                  <img src={normalizedImage} alt="normalized" style={{width:"100%",height:120,objectFit:"cover",borderRadius:10,border:"1.5px solid #10B981"}}/>
                </div>
              </div>
              {metrics && (
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                  {[["Brightness",metrics.brightnessScore?.toFixed(3)],["Contrast",metrics.contrastScore?.toFixed(3)],["Time",`${metrics.processingTime}s`]].map(([l,v])=>(
                    <div key={l} style={{background:"#F8FAFC",borderRadius:10,padding:"8px",textAlign:"center",border:"1px solid #E2E8F0"}}>
                      <p style={{fontSize:10,color:"#94A3B8"}}>{l}</p>
                      <p style={{fontSize:13,fontWeight:800,color:"#1E293B"}}>{v}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:10}}>
                <button onClick={reset} style={{background:"#F1F5F9",border:"none",borderRadius:10,padding:"10px 20px",fontSize:12,fontWeight:700,color:"#334155",cursor:"pointer"}}>Normalize Another</button>
                <button onClick={()=>setOpen(false)} style={{background:"#10B981",border:"none",borderRadius:10,padding:"10px 20px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>✓ Done</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue Shortcuts */}
      {!open && pendingQ.length>0 && (
        <div style={{padding:"12px 20px",borderTop:"1px solid #F1F5F9",background:"#F8FAFC",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:600,color:"#94A3B8",flexShrink:0}}>Queue shortcuts:</span>
          {pendingQ.slice(0,4).map((q,i)=>(
            <button key={i}
              onClick={()=>{ if(q.status==="pending") onUpdateStatus(q.id||q._id,"in-progress"); else onOpenModal(q); }}
              style={{display:"flex",alignItems:"center",gap:6,background:q.status==="in-progress"?"#0F4C81":"#EAF4FF",color:q.status==="in-progress"?"#fff":"#3A86FF",border:"none",borderRadius:99,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700}}>
                {q.patient_name?.split(" ").map(n=>n[0]).join("")}
              </div>
              {q.patient_name?.split(" ")[0]} · {q.status==="in-progress"?"Upload →":"Start"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function TechnicianDashboard() {
  const [technicians, setTechnicians] = useState([]);
  const [selectedId,  setSelectedId]  = useState("TECH-001");
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [dropOpen,    setDropOpen]    = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [scanModal,   setScanModal]   = useState(null);
  const [activeTab,   setActiveTab]   = useState("queue");

  useEffect(() => {
    api.get("/technicians").then(r => setTechnicians(r.data.technicians || [])).catch(() => {});
  }, []);

  const loadDashboard = useCallback((id) => {
    if (!id) return;
    setLoading(true); setError(null);
    api.get(`/technician-dashboard/${id}`)
      .then(r => { setData(r.data); setLastRefresh(new Date()); })
      .catch(() => setError("Failed to load dashboard. Ensure Flask backend is running."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (selectedId) loadDashboard(selectedId); }, [selectedId, loadDashboard]);
  useEffect(() => {
    const t = setInterval(() => { if (selectedId && !scanModal) loadDashboard(selectedId); }, 30000);
    return () => clearInterval(t);
  }, [selectedId, loadDashboard, scanModal]);

  const updateQueueStatus = async (itemId, status) => {
    try {
      await api.post(`/technician-queue/${selectedId}/update`, { item_id: itemId, status });
      loadDashboard(selectedId);
    } catch {}
  };

  const tech   = data?.technician;
  const stats  = data?.stats || {};
  const queue  = data?.queue || [];
  const recent = data?.recent_scans || [];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-800">Technician Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Retinal Imaging Workflow — Real-time Assessment Console</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={() => setDropOpen(v => !v)}
              style={{ display:"flex",alignItems:"center",gap:8,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:"8px 14px",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
              <Camera size={14} style={{ color:"#3A86FF" }} />
              <span style={{ fontSize:13,fontWeight:600,color:"#1E293B" }}>
                {tech?.name || technicians.find(t => (t.id||t._id)===selectedId)?.name || "Select Technician"}
              </span>
              <ChevronDown size={13} style={{ color:"#94A3B8" }} />
            </button>
            {dropOpen && (
              <div style={{ position:"absolute",top:"calc(100% + 6px)",right:0,width:280,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:14,boxShadow:"0 12px 40px rgba(0,0,0,0.13)",zIndex:100,overflow:"hidden" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 14px 6px" }}>Select Technician</p>
                {technicians.map(t => {
                  const tid = t.id || t._id || "";
                  return (
                    <div key={tid} onClick={() => { setSelectedId(tid); setDropOpen(false); }}
                      style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",background:tid===selectedId?"#EAF4FF":"transparent" }}
                      onMouseEnter={e => { if(tid!==selectedId) e.currentTarget.style.background="#F7FAFC"; }}
                      onMouseLeave={e => { if(tid!==selectedId) e.currentTarget.style.background="transparent"; }}>
                      <div style={{ width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#0F4C81,#3A86FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0 }}>
                        {t.name?.split(" ").map(n=>n[0]).join("")}
                      </div>
                      <div>
                        <p style={{ fontSize:12.5,fontWeight:600,color:"#1E293B" }}>{t.name}</p>
                        <p style={{ fontSize:10,color:"#94A3B8" }}>{t.role} · {t.shift}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button onClick={() => loadDashboard(selectedId)}
            style={{ display:"flex",alignItems:"center",gap:6,background:"#0F4C81",color:"#fff",border:"none",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer" }}>
            <RefreshCw size={13} style={{ animation:loading?"spin 1s linear infinite":"none" }} />Refresh
          </button>
        </div>
      </div>

      {lastRefresh && <p style={{ fontSize:11,color:"#94A3B8" }}>Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 30s</p>}
      {error && <div style={{ background:"#FEF2F2",border:"1.5px solid #EF4444",borderRadius:14,padding:"14px 18px",color:"#EF4444",fontSize:13 }}>⚠️ {error}</div>}

      {loading && !data && (
        <div style={{ display:"flex",justifyContent:"center",alignItems:"center",padding:"60px",flexDirection:"column",gap:12 }}>
          <div style={{ width:40,height:40,borderRadius:"50%",border:"3px solid #E2E8F0",borderTopColor:"#0F4C81",animation:"spin 0.8s linear infinite" }}/>
          <p style={{ color:"#94A3B8",fontSize:13 }}>Loading technician dashboard…</p>
        </div>
      )}

      {data && (
        <>
          {/* Banner */}
          <div style={{ background:"linear-gradient(135deg,#0F4C81,#1a5c96)",borderRadius:20,padding:"20px 24px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" }}>
            <div style={{ width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff",flexShrink:0 }}>
              {tech?.name?.split(" ").map(n=>n[0]).join("")}
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:18,fontWeight:800,color:"#fff" }}>{tech?.name}</p>
              <p style={{ fontSize:12,color:"rgba(255,255,255,0.7)" }}>{tech?.role} · {tech?.department} · {tech?.shift} Shift</p>
            </div>
            <div style={{ display:"flex",gap:20,flexWrap:"wrap" }}>
              {[{label:"Total Scans",val:stats.total_scans||0},{label:"Avg Quality",val:`${stats.avg_quality||0}%`},{label:"Avg Time",val:`${stats.avg_processing_time||0}s`}].map(({label,val}) => (
                <div key={label} style={{ textAlign:"center" }}>
                  <p style={{ fontSize:20,fontWeight:800,color:"#fff" }}>{val}</p>
                  <p style={{ fontSize:10,color:"rgba(255,255,255,0.6)" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={CheckCircle2} label="Completed Today"  value={stats.completed_today||0}          sub="Retinal scans processed" color="#10B981" />
            <StatCard icon={Clock}        label="Pending Queue"    value={stats.pending_queue||0}            sub="Awaiting imaging"        color="#F59E0B" />
            <StatCard icon={Award}        label="Quality Score"    value={`${stats.avg_quality||0}%`}        sub="Average AI confidence"   color="#3A86FF" />
            <StatCard icon={Zap}          label="Avg. Processing"  value={`${stats.avg_processing_time||0}s`} sub="Per scan"               color="#7C3AED" />
          </div>

          {/* Queue + Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="col-span-2 overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex gap-2">
                  {[["queue","Work Queue"],["recent","Recent Scans"]].map(([key,label]) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                      style={{ fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:99,border:"none",cursor:"pointer",background:activeTab===key?"#0F4C81":"#F1F5F9",color:activeTab===key?"#fff":"#64748B" }}>
                      {label} ({key==="queue"?queue.length:recent.length})
                    </button>
                  ))}
                </div>
                <Camera size={16} style={{ color:"#3A86FF" }} />
              </div>

              {activeTab === "queue" && (
                queue.length === 0 ? (
                  <div style={{ padding:"40px",textAlign:"center",color:"#94A3B8" }}>
                    <CheckCircle2 size={28} style={{ margin:"0 auto 8px",opacity:0.4 }} />
                    <p style={{ fontSize:13 }}>Queue is empty — all patients processed!</p>
                  </div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%",borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"#F8FAFC" }}>
                          {["Patient","Age/HbA1c","Priority","Last Scan","Status","Actions"].map(h => (
                            <th key={h} style={{ fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 14px",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((q, i) => {
                          const pc=PRI_COLOR[q.priority]||"#94A3B8";
                          const sc=STATUS_COLOR[q.status]||"#94A3B8";
                          const sb=STATUS_BG[q.status]||"#F8FAFC";
                          return (
                            <tr key={i} style={{ borderTop:"1px solid #F1F5F9" }}
                              onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{ padding:"12px 14px" }}>
                                <p style={{ fontSize:12.5,fontWeight:600,color:"#1E293B" }}>{q.patient_name}</p>
                                <p style={{ fontSize:10,color:"#94A3B8" }}>{q.patient_id||q.id}</p>
                                {q.notes && <p style={{ fontSize:9.5,color:"#F59E0B",marginTop:2 }}>⚠ {q.notes}</p>}
                              </td>
                              <td style={{ padding:"12px 14px" }}>
                                <p style={{ fontSize:12,color:"#334155" }}>{q.patient_age} yrs</p>
                                <p style={{ fontSize:10,color:"#94A3B8" }}>HbA1c: {q.hba1c}%</p>
                              </td>
                              <td style={{ padding:"12px 14px" }}><span style={{ background:PRI_BG[q.priority],color:pc,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99 }}>{q.priority}</span></td>
                              <td style={{ padding:"12px 14px",fontSize:11,color:"#94A3B8" }}>{q.last_scan}</td>
                              <td style={{ padding:"12px 14px" }}><span style={{ background:sb,color:sc,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99 }}>{q.status}</span></td>
                              <td style={{ padding:"12px 14px" }}>
                                <div style={{ display:"flex",gap:6 }}>
                                  {q.status==="pending" && (
                                    <button onClick={() => updateQueueStatus(q.id||q._id,"in-progress")}
                                      style={{ display:"flex",alignItems:"center",gap:4,background:"#EAF4FF",color:"#3A86FF",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer" }}>
                                      <Play size={10} /> Start
                                    </button>
                                  )}
                                  {q.status==="in-progress" && (
                                    <button onClick={() => setScanModal(q)}
                                      style={{ display:"flex",alignItems:"center",gap:4,background:"#0F4C81",color:"#fff",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer" }}>
                                      <Camera size={10} /> Upload & Process
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {activeTab === "recent" && (
                recent.length === 0 ? (
                  <div style={{ padding:"40px",textAlign:"center",color:"#94A3B8" }}>
                    <Eye size={28} style={{ margin:"0 auto 8px",opacity:0.4 }} />
                    <p style={{ fontSize:13 }}>No scans processed yet</p>
                  </div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%",borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"#F8FAFC" }}>
                          {["Scan ID","Patient","Date","Eye","Severity","Confidence"].map(h => (
                            <th key={h} style={{ fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 14px",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recent.slice(0,15).map((s,i) => {
                          const sc=SEV_COLOR[s.severity_index]||"#94A3B8";
                          return (
                            <tr key={i} style={{ borderTop:"1px solid #F1F5F9" }}
                              onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{ padding:"11px 14px",fontSize:11,fontFamily:"monospace",color:"#3A86FF",fontWeight:600 }}>{s.id||s._id}</td>
                              <td style={{ padding:"11px 14px",fontSize:12,fontWeight:500,color:"#334155" }}>{s.patient_name}</td>
                              <td style={{ padding:"11px 14px",fontSize:11,color:"#94A3B8" }}>{s.date}</td>
                              <td style={{ padding:"11px 14px",fontSize:11,color:"#64748B" }}>{s.eye}</td>
                              <td style={{ padding:"11px 14px" }}><span style={{ background:`${sc}15`,color:sc,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99 }}>{s.severity}</span></td>
                              <td style={{ padding:"11px 14px" }}>
                                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                                  <div style={{ flex:1,background:"#E2E8F0",borderRadius:99,height:5,minWidth:50 }}>
                                    <div style={{ width:`${s.confidence}%`,background:sc,borderRadius:99,height:5 }} />
                                  </div>
                                  <span style={{ fontSize:11,fontWeight:700,color:"#334155",width:36 }}>{s.confidence}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </Card>

            <div className="col-span-1 space-y-5">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div><p className="font-bold text-slate-800" style={{fontSize:14}}>Weekly Performance</p><p className="text-xs text-slate-400">Scans per day</p></div>
                  <TrendingUp size={16} style={{ color:"#10B981" }} />
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.weekly_performance} margin={{ top:4,right:4,left:-24,bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize:10,fill:"#94A3B8" }} />
                    <YAxis tick={{ fontSize:10,fill:"#94A3B8" }} />
                    <Tooltip content={<ScanTooltip />} />
                    <Bar dataKey="scans" radius={[5,5,0,0]}>
                      {data.weekly_performance.map((e, i) => (
                        <Cell key={i} fill={e.day===new Date().toLocaleDateString("en",{weekday:"short"})?"#3A86FF":"#0F4C81"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div><p className="font-bold text-slate-800" style={{fontSize:14}}>Severity Mix</p><p className="text-xs text-slate-400">All processed scans</p></div>
                  <Activity size={16} style={{ color:"#7C3AED" }} />
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={data.severity_distribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                      {data.severity_distribution.map((e,i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(val,name) => [`${val} scans`,name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {data.severity_distribution.map((s,i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{ width:8,height:8,borderRadius:"50%",background:s.color }} />
                        <span style={{ fontSize:10.5,color:"#64748B" }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize:11,fontWeight:700,color:"#334155" }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* ── Standalone Upload Panel ── */}
          <StandaloneUpload techId={selectedId} queue={queue} onUpdateStatus={updateQueueStatus} onOpenModal={q=>setScanModal(q)} onScanDone={()=>setTimeout(()=>loadDashboard(selectedId),600)}/>
        </>
      )}

      {/* Scan Modal */}
      {scanModal && (
        <ScanModal
          queueItem={scanModal}
          techId={selectedId}
          onClose={() => setScanModal(null)}
          onSuccess={() => { setTimeout(() => loadDashboard(selectedId), 600); }}
        />
      )}
    </div>
  );
}
