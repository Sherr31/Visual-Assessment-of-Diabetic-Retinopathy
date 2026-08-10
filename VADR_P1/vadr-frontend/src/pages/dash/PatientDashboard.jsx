import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  Eye, Activity, Calendar, AlertTriangle, CheckCircle2, ChevronDown,
  RefreshCw, User, Heart, Droplet, TrendingUp, Info, Stethoscope,
  Shield, Upload, X, Camera, FileImage, Brain, FileText, Printer,
  Plus, Clock, Check
} from "lucide-react";
import api, { normalizeImage } from "../../utils/api";

const SEV_COLOR  = ["#10B981","#F59E0B","#F97316","#EF4444","#7C3AED"];
const SEV_BG     = ["#ECFDF5","#FFFBEB","#FFF7ED","#FEF2F2","#F5F3FF"];
const SEV_LABELS = ["No DR","Mild DR","Moderate DR","Severe DR","Proliferative DR"];
const SEV_ICON   = [CheckCircle2,AlertTriangle,AlertTriangle,AlertTriangle,AlertTriangle];

const Card = ({children,className="",style={}}) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`} style={style}>{children}</div>
);

/* ─── Retinal Upload — Normalization Module ──────────────────────────────── */
function RetinalUpload({ patientId, onScanComplete }) {
  const [file,setFile]=useState(null); const [preview,setPreview]=useState(null);
  const [eye,setEye]=useState("Right Eye"); const [drag,setDrag]=useState(false);
  const [loading,setLoading]=useState(false);
  const [normalizedImage,setNormalizedImage]=useState(null);
  const [metrics,setMetrics]=useState(null);
  const [error,setError]=useState(null);
  const inputRef=useRef();

  const handleFile=(f)=>{ if(!f||!f.type.startsWith("image/")){ setError("Please select a valid image file."); return; } if(f.size>20*1024*1024){ setError("Max 20 MB."); return; } setFile(f); setPreview(URL.createObjectURL(f)); setNormalizedImage(null); setMetrics(null); setError(null); };
  const handleDrop=(e)=>{ e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); };
  const reset=()=>{ setFile(null); setPreview(null); setNormalizedImage(null); setMetrics(null); setError(null); };

  const handleNormalize=async()=>{
    if(!file) return; setLoading(true); setError(null);
    try {
      const data = await normalizeImage(file);
      setNormalizedImage(data.normalizedImage);
      setMetrics(data.metrics);
      onScanComplete&&onScanComplete(data);
    } catch(e) { setError(e?.response?.data?.error||e?.message||"Normalization failed. Ensure Flask backend is running."); }
    finally { setLoading(false); }
  };

  return (
    <div>
      {/* Drop Zone */}
      <div onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
        onClick={()=>!file&&inputRef.current?.click()}
        style={{ border:`2px dashed ${drag?"#10B981":file?"#10B981":"#CBD5E1"}`,borderRadius:14,padding:file?10:24,textAlign:"center",background:drag?"#ECFDF5":file?"#F0FDF4":"#F8FAFC",cursor:file?"default":"pointer",marginBottom:14 }}>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); }}/>
        {!file ? (
          <>
            <div style={{width:48,height:48,borderRadius:14,background:"#ECFDF5",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><FileImage size={22} style={{color:"#10B981"}}/></div>
            <p style={{fontSize:14,fontWeight:700,color:"#334155",marginBottom:4}}>Drop your retinal image here</p>
            <p style={{fontSize:12,color:"#94A3B8",marginBottom:12}}>JPG, PNG · max 20 MB</p>
            <span style={{fontSize:11,fontWeight:600,color:"#10B981",background:"#ECFDF5",padding:"5px 14px",borderRadius:99}}>Browse Files</span>
          </>
        ) : (
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <img src={preview} alt="preview" style={{width:68,height:68,borderRadius:10,objectFit:"cover",border:"2px solid #10B981",flexShrink:0}}/>
            <div style={{flex:1,textAlign:"left"}}><p style={{fontSize:13,fontWeight:600,color:"#1E293B"}}>{file.name}</p><p style={{fontSize:11,color:"#94A3B8"}}>{(file.size/1024/1024).toFixed(2)} MB · Ready to normalize</p></div>
            <button onClick={e=>{e.stopPropagation();reset();}} style={{background:"#FEF2F2",border:"none",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={12} style={{color:"#EF4444"}}/></button>
          </div>
        )}
      </div>

      {/* Eye selector + Normalize button */}
      {!normalizedImage && (
        <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:12}}>
          <div style={{flex:1}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>Eye Being Scanned</label>
            <div style={{display:"flex",gap:8}}>
              {["Right Eye","Left Eye"].map(opt=>(
                <button key={opt} onClick={()=>setEye(opt)} style={{flex:1,padding:"8px",borderRadius:10,border:`1.5px solid ${eye===opt?"#10B981":"#E2E8F0"}`,background:eye===opt?"#ECFDF5":"#fff",fontSize:12,fontWeight:600,color:eye===opt?"#059669":"#64748B",cursor:"pointer"}}>{opt}</button>
              ))}
            </div>
          </div>
          <button onClick={handleNormalize} disabled={!file||loading}
            style={{background:!file||loading?"#94A3B8":"#059669",color:"#fff",border:"none",borderRadius:12,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:!file||loading?"default":"pointer",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
            {loading
              ? <><div style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite"}}/>Normalizing…</>
              : <><Activity size={14}/>Normalize Image</>
            }
          </button>
        </div>
      )}

      {error&&<p style={{fontSize:12,color:"#EF4444",marginTop:10,background:"#FEF2F2",borderRadius:10,padding:"8px 12px"}}>⚠ {error}</p>}

      {/* Normalization Result */}
      {normalizedImage && (
        <div style={{marginTop:4}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:"#ECFDF5",display:"flex",alignItems:"center",justifyContent:"center"}}><CheckCircle2 size={14} style={{color:"#10B981"}}/></div>
            <p style={{fontSize:13,fontWeight:700,color:"#1E293B"}}>Normalization Complete</p>
            <span style={{marginLeft:"auto",fontSize:10,fontWeight:600,background:"#ECFDF5",color:"#059669",padding:"3px 10px",borderRadius:99}}>Ready</span>
          </div>

          {/* Before / After */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:5}}>ORIGINAL — {eye}</p>
              <img src={preview} alt="original" style={{width:"100%",height:110,objectFit:"cover",borderRadius:10,border:"1.5px solid #E2E8F0"}}/>
            </div>
            <div style={{textAlign:"center"}}>
              <p style={{fontSize:10,color:"#059669",fontWeight:600,marginBottom:5}}>NORMALIZED</p>
              <img src={normalizedImage} alt="normalized" style={{width:"100%",height:110,objectFit:"cover",borderRadius:10,border:"1.5px solid #10B981"}}/>
            </div>
          </div>

          {/* Metrics */}
          {metrics && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
              {[["Brightness",metrics.brightnessScore?.toFixed(3)],["Contrast",metrics.contrastScore?.toFixed(3)],["Time",`${metrics.processingTime}s`]].map(([l,v])=>(
                <div key={l} style={{background:"#F8FAFC",borderRadius:10,padding:"8px",textAlign:"center",border:"1px solid #E2E8F0"}}>
                  <p style={{fontSize:10,color:"#94A3B8"}}>{l}</p>
                  <p style={{fontSize:14,fontWeight:800,color:"#1E293B"}}>{v}</p>
                </div>
              ))}
            </div>
          )}
          <p style={{fontSize:10,color:"#94A3B8",textAlign:"center",marginBottom:12}}>
            Pipeline: resize → color norm → gamma correction → CLAHE → denoise → standardize
          </p>
          <button onClick={reset} style={{background:"#F1F5F9",border:"none",borderRadius:10,padding:"9px 18px",fontSize:12,fontWeight:700,color:"#334155",cursor:"pointer",width:"100%"}}>Upload Another Scan</button>
        </div>
      )}
    </div>
  );
}

/* ─── Book Appointment Modal ─────────────────────────────────────────────── */
function BookAppointmentModal({ patient, technicians, onClose, onBooked }) {
  const today=new Date().toISOString().split("T")[0];
  const [form,setForm]=useState({ date:"", time:"09:00", type:"Annual Retinal Scan", technician_id:"TECH-001", notes:"" });
  const [loading,setLoading]=useState(false); const [success,setSuccess]=useState(false); const [error,setError]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  const submit=async()=>{
    if(!form.date){ setError("Please select a date."); return; }
    setLoading(true); setError(null);
    try {
      await api.post("/appointments",{ ...form, patient_id:patient?.id||"", patient_name:patient?.name||"" });
      setSuccess(true); setTimeout(()=>{ onBooked&&onBooked(); onClose(); },1800);
    } catch { setError("Booking failed. Please try again."); } finally { setLoading(false); }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={e=>e.target===e.currentTarget&&!loading&&onClose()}>
      <div style={{background:"#fff",borderRadius:22,width:"100%",maxWidth:460,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.22)"}}>
        <div style={{background:"linear-gradient(135deg,#10B981,#059669)",padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><p style={{fontSize:16,fontWeight:800,color:"#fff"}}>Book Appointment</p><p style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>{patient?.name} · {patient?.id}</p></div>
          {!loading&&<button onClick={onClose} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff"}}><X size={13}/></button>}
        </div>
        <div style={{padding:24}}>
          {success?(
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{width:60,height:60,borderRadius:"50%",background:"#ECFDF5",border:"2px solid #10B981",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Check size={28} style={{color:"#10B981"}}/></div>
              <p style={{fontSize:18,fontWeight:800,color:"#10B981",marginBottom:6}}>Appointment Booked!</p>
              <p style={{fontSize:13,color:"#64748B"}}>Your appointment has been scheduled successfully.</p>
            </div>
          ) : (
            <>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>Appointment Type</label>
                <select value={form.type} onChange={e=>set("type",e.target.value)} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}>
                  {["Annual Retinal Scan","Follow-up Scan","Urgent Assessment","Routine Check-up"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{display:"flex",gap:10,marginBottom:14}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>Date *</label>
                  <input type="date" value={form.date} min={today} onChange={e=>set("date",e.target.value)} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="#10B981"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>Time</label>
                  <select value={form.time} onChange={e=>set("time",e.target.value)} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none"}}>
                    {["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","14:00","14:30","15:00","15:30","16:00"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>Assign Technician</label>
                <select value={form.technician_id} onChange={e=>set("technician_id",e.target.value)} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none"}}>
                  {(technicians.length?technicians:[{id:"TECH-001",name:"Ali Hassan"},{id:"TECH-002",name:"Maria Qureshi"},{id:"TECH-003",name:"Kamran Asif"}]).map(t=>(
                    <option key={t.id||t._id} value={t.id||t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div style={{marginBottom:18}}>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>Notes (optional)</label>
                <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any special requirements or concerns…" rows={2} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor="#10B981"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/>
              </div>
              {error&&<p style={{fontSize:12,color:"#EF4444",background:"#FEF2F2",borderRadius:10,padding:"8px 12px",marginBottom:14}}>⚠ {error}</p>}
              <button onClick={submit} disabled={loading||!form.date}
                style={{width:"100%",background:loading||!form.date?"#94A3B8":"#10B981",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:loading||!form.date?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {loading?<><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite"}}/>Booking…</>:<><Calendar size={15}/>Confirm Appointment</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Patient Report ─────────────────────────────────────────────────────── */
function PatientReport({ data, onClose }) {
  const { patient, scan_history, appointments, summary } = data;
  const si   = summary?.severity_index ?? 0;
  const sc   = SEV_COLOR[si];
  const now  = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});

  const handlePrint = () => window.print();

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:1000,padding:20,overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:0,width:"100%",maxWidth:760,boxShadow:"0 24px 80px rgba(0,0,0,0.3)",marginBottom:20}}>
        {/* Actions bar (not printed) */}
        <div className="no-print" style={{background:"#1E293B",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <p style={{fontSize:13,fontWeight:600,color:"#fff"}}>Patient Report — Preview</p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={handlePrint} style={{display:"flex",alignItems:"center",gap:6,background:"#10B981",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}><Printer size={13}/>Print / Save PDF</button>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Close</button>
          </div>
        </div>

        {/* Report Body */}
        <div id="report-body" style={{padding:"40px 48px",fontFamily:"'Segoe UI',Arial,sans-serif"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28,paddingBottom:20,borderBottom:"2px solid #0F4C81"}}>
            <div>
              <p style={{fontSize:22,fontWeight:800,color:"#0F4C81",marginBottom:2}}>VADR Platform</p>
              <p style={{fontSize:11,color:"#64748B"}}>Visual Assessment for Diabetic Retinopathy</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:13,fontWeight:700,color:"#1E293B"}}>Retinopathy Assessment Report</p>
              <p style={{fontSize:11,color:"#94A3B8"}}>Generated: {now}</p>
              <p style={{fontSize:11,color:"#94A3B8"}}>Report ID: {data.report_id}</p>
            </div>
          </div>

          {/* Patient Info */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
            <div style={{background:"#F8FAFC",borderRadius:12,padding:"16px"}}>
              <p style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Patient Information</p>
              {[["Name",patient?.name],["ID",patient?.id||patient?._id],["Age",`${patient?.age} years`],["Gender",patient?.gender],["Phone",patient?.phone],["Email",patient?.email]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}><span style={{color:"#94A3B8"}}>{l}</span><span style={{fontWeight:600,color:"#1E293B"}}>{v||"—"}</span></div>
              ))}
            </div>
            <div style={{background:"#F8FAFC",borderRadius:12,padding:"16px"}}>
              <p style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Clinical Details</p>
              {[["Diabetic Years",`${patient?.diabetic_years} years`],["HbA1c",`${patient?.hba1c}%`],["Blood Pressure",patient?.blood_pressure],["Total Scans",summary?.total_scans],["First Scan",summary?.first_scan||"N/A"],["Latest Scan",summary?.latest_scan||"N/A"]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}><span style={{color:"#94A3B8"}}>{l}</span><span style={{fontWeight:600,color:"#1E293B"}}>{v||"—"}</span></div>
              ))}
            </div>
          </div>

          {/* Current Status */}
          <div style={{background:`${sc}10`,border:`1.5px solid ${sc}30`,borderRadius:14,padding:"16px 20px",marginBottom:24}}>
            <p style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Current DR Assessment</p>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div>
                <p style={{fontSize:26,fontWeight:800,color:sc}}>{summary?.current_severity}</p>
                <p style={{fontSize:12,color:"#64748B"}}>Risk Level: <strong style={{color:sc}}>{summary?.risk_level}</strong></p>
              </div>
              <div style={{flex:1}}>
                <div style={{background:"#E2E8F0",borderRadius:99,height:10,marginBottom:6}}>
                  <div style={{width:`${(si/4)*100}%`,background:sc,borderRadius:99,height:10}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#94A3B8"}}><span>No DR</span><span>Proliferative DR</span></div>
              </div>
            </div>
            <div style={{marginTop:12,padding:"10px 14px",background:`${sc}08`,borderRadius:10}}>
              <p style={{fontSize:12,color:"#475569",lineHeight:1.7}}><strong>Recommendation: </strong>{summary?.recommendation}</p>
            </div>
          </div>

          {/* Scan History Table */}
          {scan_history?.length>0 && (
            <div style={{marginBottom:24}}>
              <p style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Scan History ({scan_history.length} records)</p>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:"#F8FAFC"}}>
                  {["Date","Eye","DR Stage","Confidence","Features Detected"].map(h=>(
                    <th key={h} style={{fontSize:10,fontWeight:700,color:"#94A3B8",padding:"8px 12px",textAlign:"left",borderBottom:"1px solid #E2E8F0"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[...scan_history].reverse().map((s,i)=>{
                    const c=SEV_COLOR[s.severity_index]; const bg=SEV_BG[s.severity_index];
                    return (
                      <tr key={i} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"8px 12px",color:"#334155"}}>{s.date}</td>
                        <td style={{padding:"8px 12px",color:"#64748B"}}>{s.eye}</td>
                        <td style={{padding:"8px 12px"}}><span style={{background:bg,color:c,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99}}>{s.severity}</span></td>
                        <td style={{padding:"8px 12px",fontWeight:700,color:"#334155"}}>{s.confidence}%</td>
                        <td style={{padding:"8px 12px",color:"#64748B"}}>
                          {s.severity_index>=1?"Microaneurysms ":""}{s.severity_index>=2?"Hemorrhages ":""}{s.severity_index>=4?"Neovascularization":""}{s.severity_index===0?"None detected":""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Appointments */}
          {appointments?.length>0 && (
            <div style={{marginBottom:24}}>
              <p style={{fontSize:12,fontWeight:700,color:"#475569",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>Upcoming Appointments</p>
              {appointments.filter(a=>a.status!=="cancelled").map((a,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"#EAF4FF",borderRadius:10,marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:"#1E293B"}}>{a.type}</span>
                  <span style={{fontSize:11,color:"#64748B"}}>{a.date} at {a.time}</span>
                  <span style={{fontSize:10,fontWeight:700,color:"#3A86FF",background:"#fff",padding:"2px 8px",borderRadius:99}}>{a.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{borderTop:"1px solid #E2E8F0",paddingTop:16,marginTop:10}}>
            <p style={{fontSize:10,color:"#94A3B8",textAlign:"center"}}>This report was generated automatically by the VADR Platform. For clinical decisions, please consult a qualified ophthalmologist. · {now}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */
export default function PatientDashboard() {
  const [patients,    setPatients]    = useState([]);
  const [selectedId,  setSelectedId]  = useState("");
  const [data,        setData]        = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [dropOpen,    setDropOpen]    = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [panel,       setPanel]       = useState(null); // null | "upload" | "book"
  const [report,      setReport]      = useState(null);
  const [reportLoad,  setReportLoad]  = useState(false);

  useEffect(()=>{
    api.get("/patients-list").then(r=>{ const p=r.data.patients||[]; setPatients(p); if(p.length) setSelectedId(p[0].id||p[0]._id||""); }).catch(()=>{});
    api.get("/technicians").then(r=>setTechnicians(r.data.technicians||[])).catch(()=>{});
  },[]);

  const loadDashboard=useCallback((id)=>{ if(!id) return; setLoading(true); setError(null); api.get(`/patient-dashboard/${id}`).then(r=>{setData(r.data);setLastRefresh(new Date());}).catch(()=>setError("Failed to load data. Check backend.")).finally(()=>setLoading(false)); },[]);
  useEffect(()=>{ if(selectedId) loadDashboard(selectedId); },[selectedId,loadDashboard]);
  useEffect(()=>{ const t=setInterval(()=>{if(selectedId)loadDashboard(selectedId);},30000); return()=>clearInterval(t); },[selectedId,loadDashboard]);

  const generateReport=async()=>{ setReportLoad(true); try{ const r=await api.get(`/patient-report/${selectedId}`); setReport(r.data); }catch{ setError("Report generation failed."); } finally{ setReportLoad(false); } };

  const patient=data?.patient; const si=patient?.current_severity_index??0;
  const SevIcon=SEV_ICON[si]||CheckCircle2; const sevColor=SEV_COLOR[si];
  const hba1cVal=patient?.hba1c||0; const hba1cGood=hba1cVal<7; const hba1cWarn=hba1cVal>=7&&hba1cVal<8;
  const hba1cColor=hba1cGood?"#10B981":hba1cWarn?"#F59E0B":"#EF4444";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-800">Patient Portal</h1>
          <p className="text-sm text-slate-500 mt-0.5">Diabetic Retinopathy Visual Assessment — Patient View</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Patient selector */}
          <div className="relative">
            <button onClick={()=>setDropOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:7,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:"7px 12px",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <User size={13} style={{color:"#3A86FF"}}/><span style={{fontSize:12,fontWeight:600,color:"#1E293B"}}>{patients.find(p=>(p.id||p._id)===selectedId)?.name||"Select Patient"}</span><ChevronDown size={12} style={{color:"#94A3B8"}}/>
            </button>
            {dropOpen&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,width:250,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:14,boxShadow:"0 12px 40px rgba(0,0,0,0.13)",zIndex:100,overflow:"hidden"}}>
                <p style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 14px 6px"}}>Select Patient</p>
                <div style={{maxHeight:240,overflowY:"auto"}}>
                  {patients.map(p=>{ const pid=p.id||p._id||""; const pidx=SEV_LABELS.indexOf(p.current_severity||""); const pc=SEV_COLOR[pidx]||"#94A3B8";
                    return (<div key={pid} onClick={()=>{setSelectedId(pid);setDropOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",cursor:"pointer",background:pid===selectedId?"#EAF4FF":"transparent"}} onMouseEnter={e=>{if(pid!==selectedId)e.currentTarget.style.background="#F7FAFC";}} onMouseLeave={e=>{if(pid!==selectedId)e.currentTarget.style.background="transparent";}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${pc},${pc}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>{p.name?.split(" ").map(n=>n[0]).join("")}</div>
                      <div style={{flex:1,minWidth:0}}><p style={{fontSize:12,fontWeight:600,color:"#1E293B"}}>{p.name}</p><p style={{fontSize:10,color:"#94A3B8"}}>{pid}</p></div>
                    </div>);
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {[
            {key:"upload",icon:Camera,label:"Upload Scan",color:"#10B981",bg:"#ECFDF5",border:"#BBF7D0"},
            {key:"book",icon:Calendar,label:"Book Appointment",color:"#3A86FF",bg:"#EAF4FF",border:"#BFDBFE"},
          ].map(({key,icon:Icon,label,color,bg,border})=>(
            <button key={key} onClick={()=>setPanel(panel===key?null:key)}
              style={{display:"flex",alignItems:"center",gap:6,background:panel===key?color:bg,color:panel===key?"#fff":color,border:`1.5px solid ${panel===key?color:border}`,borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              <Icon size={13}/>{label}
            </button>
          ))}

          <button onClick={generateReport} disabled={reportLoad||!selectedId}
            style={{display:"flex",alignItems:"center",gap:6,background:reportLoad?"#94A3B8":"#7C3AED",color:"#fff",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:reportLoad?"default":"pointer"}}>
            {reportLoad?<><div style={{width:12,height:12,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite"}}/>Generating…</>:<><FileText size={13}/>Report</>}
          </button>
          <button onClick={()=>loadDashboard(selectedId)} style={{display:"flex",alignItems:"center",gap:6,background:"#0F4C81",color:"#fff",border:"none",borderRadius:10,padding:"7px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            <RefreshCw size={13} style={{animation:loading?"spin 1s linear infinite":"none"}}/>Refresh
          </button>
        </div>
      </div>

      {lastRefresh&&<p style={{fontSize:11,color:"#94A3B8"}}>Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 30s</p>}
      {error&&<div style={{background:"#FEF2F2",border:"1.5px solid #EF4444",borderRadius:14,padding:"12px 16px",color:"#EF4444",fontSize:13}}>⚠️ {error}</div>}

      {/* Upload Panel */}
      {panel==="upload"&&(
        <Card className="p-5" style={{border:"1.5px solid #BBF7D0",background:"linear-gradient(135deg,#F0FDF4,#ECFDF5)"}}>
          <div className="flex items-center gap-3 mb-5">
            <div style={{width:40,height:40,borderRadius:12,background:"#10B981",display:"flex",alignItems:"center",justifyContent:"center"}}><Camera size={18} style={{color:"#fff"}}/></div>
            <div><p className="font-bold text-slate-800">Submit Retinal Scan for AI Assessment</p><p className="text-xs text-slate-500">Upload a fundus photograph for instant DR severity diagnosis</p></div>
          </div>
          <RetinalUpload patientId={selectedId} onScanComplete={()=>setTimeout(()=>loadDashboard(selectedId),800)}/>
        </Card>
      )}

      {/* Loading */}
      {loading&&!data&&(<div style={{display:"flex",justifyContent:"center",alignItems:"center",padding:"60px",flexDirection:"column",gap:12}}><div style={{width:40,height:40,borderRadius:"50%",border:"3px solid #E2E8F0",borderTopColor:"#0F4C81",animation:"spin 0.8s linear infinite"}}/><p style={{color:"#94A3B8",fontSize:13}}>Loading patient data…</p></div>)}

      {data&&patient&&(
        <>
          {/* Row 1: Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Patient Info */}
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${sevColor},${sevColor}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff",flexShrink:0}}>{patient.name?.split(" ").map(n=>n[0]).join("")}</div>
                <div><p className="font-bold text-slate-800">{patient.name}</p><p className="text-xs text-slate-400">{patient.id||selectedId}</p></div>
              </div>
              {[["Age",`${patient.age} yrs`],["Gender",patient.gender],["Diabetic Years",`${patient.diabetic_years} yrs`],["Phone",patient.phone]].map(([l,v])=>(
                <div key={l} className="flex justify-between text-xs mb-2"><span className="text-slate-400">{l}</span><span className="font-semibold text-slate-700">{v}</span></div>
              ))}
              <div className="mt-3 pt-3 border-t border-slate-100"><p className="text-xs text-slate-400 mb-1">Last Scan</p><p className="font-semibold text-slate-700 text-xs">{patient.last_scan_date||"N/A"}</p></div>
            </Card>

            {/* DR Status */}
            <Card className="p-5" style={{background:`linear-gradient(135deg,${sevColor}12,${sevColor}05)`,border:`1.5px solid ${sevColor}25`}}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Current DR Status</p>
              <div className="flex items-center gap-3 mb-3">
                <div style={{width:48,height:48,borderRadius:12,background:`${sevColor}20`,display:"flex",alignItems:"center",justifyContent:"center"}}><SevIcon size={24} style={{color:sevColor}}/></div>
                <div><p style={{fontSize:18,fontWeight:800,color:sevColor}}>{patient.current_severity}</p><p className="text-xs text-slate-400">Stage {si} of 4</p></div>
              </div>
              <div style={{background:"#E2E8F0",borderRadius:99,height:7,marginBottom:8}}><div style={{width:`${(si/4)*100}%`,background:sevColor,borderRadius:99,height:7}}/></div>
              <div className="flex justify-between text-xs text-slate-400 mb-3"><span>No DR</span><span>Proliferative</span></div>
              <div className="p-2.5 rounded-xl" style={{background:`${sevColor}10`}}><p style={{fontSize:11,color:"#475569",lineHeight:1.6}}>{data.recommendation}</p></div>
            </Card>

            {/* Health */}
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Health Metrics</p>
              <div>
                <div className="flex justify-between items-center mb-1"><div className="flex items-center gap-1.5"><Droplet size={12} style={{color:hba1cColor}}/><span className="text-xs text-slate-500">HbA1c</span></div><span style={{fontSize:15,fontWeight:800,color:hba1cColor}}>{hba1cVal}%</span></div>
                <div style={{background:"#E2E8F0",borderRadius:99,height:6,marginBottom:3}}><div style={{width:`${Math.min(((hba1cVal-5)/7)*100,100)}%`,background:hba1cColor,borderRadius:99,height:6}}/></div>
                <p style={{fontSize:10,color:hba1cColor,marginBottom:14}}>{hba1cGood?"✓ On target":hba1cWarn?"⚠ Above target":"✗ Poorly controlled"}</p>
                <div className="flex justify-between items-center mb-3"><div className="flex items-center gap-1.5"><Heart size={12} style={{color:"#EF4444"}}/><span className="text-xs text-slate-500">Blood Pressure</span></div><span style={{fontSize:13,fontWeight:700,color:"#1E293B"}}>{patient.blood_pressure}</span></div>
                <div className="flex justify-between items-center"><div className="flex items-center gap-1.5"><Eye size={12} style={{color:"#3A86FF"}}/><span className="text-xs text-slate-500">Total Scans</span></div><span style={{fontSize:13,fontWeight:700,color:"#1E293B"}}>{data.total_scans}</span></div>
              </div>
            </Card>

            {/* Risk */}
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Risk Assessment</p>
              <div className="text-center mb-4">
                <div style={{width:64,height:64,borderRadius:"50%",background:`${data.risk_color}15`,border:`3px solid ${data.risk_color}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px"}}><Shield size={28} style={{color:data.risk_color}}/></div>
                <p style={{fontSize:20,fontWeight:800,color:data.risk_color}}>{data.risk_level}</p>
                <p className="text-xs text-slate-400">Risk Level</p>
              </div>
              {["microaneurysms","hemorrhages","neovascularization"].map(f=>(
                <div key={f} className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-400 capitalize">{f.replace(/_/g," ")}</span>
                  <span style={{fontWeight:700,color:data.last_scan?.features?.[f]?"#EF4444":"#10B981"}}>{data.last_scan?.features?.[f]?"Detected":"None"}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Row 2: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4"><div><p className="font-bold text-slate-800">DR Severity History</p><p className="text-xs text-slate-400">Retinopathy progression over time</p></div><Activity size={18} style={{color:"#3A86FF"}}/></div>
              {data.scan_history?.length>0?(
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.scan_history} margin={{top:8,right:16,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:"#94A3B8"}} tickFormatter={d=>d.slice(5)}/>
                    <YAxis domain={[0,4]} ticks={[0,1,2,3,4]} tick={{fontSize:10,fill:"#94A3B8"}} tickFormatter={v=>["No","Mild","Mod","Sev","Pro"][v]}/>
                    <Tooltip formatter={(v,n,p)=>[SEV_LABELS[v],""]} labelFormatter={l=>l}/>
                    {SEV_LABELS.map((lbl,i)=><ReferenceLine key={lbl} y={i} stroke={`${SEV_COLOR[i]}30`} strokeDasharray="4 4"/>)}
                    <Line type="monotoneX" dataKey="severity_index" stroke="#3A86FF" strokeWidth={2.5} dot={{r:5,fill:"#3A86FF",stroke:"#fff",strokeWidth:2}} activeDot={{r:7}}/>
                  </LineChart>
                </ResponsiveContainer>
              ):(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:180,color:"#94A3B8",flexDirection:"column",gap:8}}><Eye size={26} style={{opacity:0.4}}/><p style={{fontSize:13}}>No scan history yet</p></div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4"><div><p className="font-bold text-slate-800">HbA1c Trend</p><p className="text-xs text-slate-400">Glycated haemoglobin over 6 months</p></div><TrendingUp size={18} style={{color:hba1cColor}}/></div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.hba1c_trend} margin={{top:8,right:16,left:-20,bottom:0}}>
                  <defs><linearGradient id="hba1cGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={hba1cColor} stopOpacity={0.2}/><stop offset="95%" stopColor={hba1cColor} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:"#94A3B8"}}/>
                  <YAxis domain={[5.5,12]} tick={{fontSize:10,fill:"#94A3B8"}}/>
                  <Tooltip formatter={v=>[`${v}%`,"HbA1c"]}/>
                  <ReferenceLine y={7} stroke="#10B981" strokeDasharray="5 3"/>
                  <Area type="monotone" dataKey="value" stroke={hba1cColor} strokeWidth={2.5} fill="url(#hba1cGrad)" dot={{r:4,fill:hba1cColor,stroke:"#fff",strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Row 3: Table + Appointments */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="col-span-2 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div><p className="font-bold text-slate-800">Scan History</p><p className="text-xs text-slate-400">{data.total_scans} retinal assessments</p></div>
                <Eye size={16} style={{color:"#3A86FF"}}/>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"#F8FAFC"}}>{["Date","Eye","Severity","Confidence","Features"].map(h=><th key={h} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 16px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...data.scan_history].reverse().map((s,i)=>{ const sc=SEV_COLOR[s.severity_index]||"#94A3B8"; const sb=SEV_BG[s.severity_index]||"#F8FAFC"; return (
                      <tr key={i} style={{borderTop:"1px solid #F1F5F9"}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"11px 16px",fontSize:12,fontWeight:500,color:"#334155"}}>{s.date}</td>
                        <td style={{padding:"11px 16px",fontSize:12,color:"#64748B"}}>{s.eye}</td>
                        <td style={{padding:"11px 16px"}}><span style={{background:sb,color:sc,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{s.severity}</span></td>
                        <td style={{padding:"11px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{flex:1,background:"#E2E8F0",borderRadius:99,height:5}}><div style={{width:`${s.confidence}%`,background:sc,borderRadius:99,height:5}}/></div><span style={{fontSize:11,fontWeight:700,color:"#334155",width:36}}>{s.confidence}%</span></div>
                        </td>
                        <td style={{padding:"11px 16px"}}>
                          <div style={{display:"flex",gap:4}}>
                            {s.severity_index>=1&&<span style={{fontSize:9,background:"#FEF3C7",color:"#D97706",padding:"1px 6px",borderRadius:4}}>MA</span>}
                            {s.severity_index>=2&&<span style={{fontSize:9,background:"#FEE2E2",color:"#DC2626",padding:"1px 6px",borderRadius:4}}>HEM</span>}
                            {s.severity_index>=4&&<span style={{fontSize:9,background:"#F3E8FF",color:"#7C3AED",padding:"1px 6px",borderRadius:4}}>NVD</span>}
                            {s.severity_index===0&&<span style={{fontSize:9,color:"#94A3B8"}}>None</span>}
                          </div>
                        </td>
                      </tr>
                    ); })}
                    {data.scan_history?.length===0&&<tr><td colSpan={5} style={{padding:"40px",textAlign:"center",color:"#94A3B8"}}>No scans recorded yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Appointments sidebar */}
            <Card className="col-span-1 p-5">
              <div className="flex items-center justify-between mb-4">
                <div><p className="font-bold text-slate-800">Appointments</p><p className="text-xs text-slate-400">Upcoming sessions</p></div>
                <button onClick={()=>setPanel(panel==="book"?null:"book")} style={{display:"flex",alignItems:"center",gap:4,background:"#EAF4FF",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,color:"#3A86FF",cursor:"pointer"}}><Plus size={11}/>Book</button>
              </div>
              <div className="space-y-3">
                {data.appointments?.length>0 ? data.appointments.map((a,i)=>(
                  <div key={i} style={{border:"1.5px solid #DBEAFE",borderRadius:12,padding:"11px 13px"}}>
                    <p style={{fontSize:12,fontWeight:700,color:"#1E293B",marginBottom:4}}>{a.type}</p>
                    <div className="flex items-center gap-1.5 mb-1"><Calendar size={10} style={{color:"#94A3B8"}}/><span style={{fontSize:11,color:"#64748B"}}>{a.date} at {a.time}</span></div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><Stethoscope size={10} style={{color:"#94A3B8"}}/><span style={{fontSize:10,color:"#94A3B8"}}>{a.technician_id}</span></div>
                      <span style={{fontSize:9.5,fontWeight:700,color:"#3A86FF",background:"#EAF4FF",padding:"2px 7px",borderRadius:99}}>{a.status}</span>
                    </div>
                  </div>
                )) : (
                  <div style={{textAlign:"center",padding:"24px 10px",color:"#94A3B8"}}>
                    <Calendar size={22} style={{margin:"0 auto 8px",opacity:0.4}}/>
                    <p style={{fontSize:12,marginBottom:12}}>No upcoming appointments</p>
                    <button onClick={()=>setPanel("book")} style={{background:"#EAF4FF",border:"none",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:600,color:"#3A86FF",cursor:"pointer"}}>+ Book Now</button>
                  </div>
                )}
              </div>
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F1F5F9"}}>
                <p style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:6}}>Next Steps</p>
                <div style={{background:"#EAF4FF",borderRadius:10,padding:"9px 11px"}}>
                  <p style={{fontSize:11,color:"#334155",lineHeight:1.7}}>
                    {si===0&&"✓ Continue annual retinal screening"}
                    {si===1&&"• Follow-up in 12 months"}
                    {si===2&&"• Ophthalmology referral in 3–6 months"}
                    {si===3&&"⚠ Urgent referral required"}
                    {si===4&&"🔴 Immediate consultation needed"}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Book Appointment Modal */}
      {panel==="book"&&data&&<BookAppointmentModal patient={data.patient} technicians={technicians} onClose={()=>setPanel(null)} onBooked={()=>loadDashboard(selectedId)}/>}

      {/* Report Modal */}
      {report&&<PatientReport data={report} onClose={()=>setReport(null)}/>}
    </div>
  );
}
