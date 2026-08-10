import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Users, Camera, Calendar, AlertTriangle, Activity,
  RefreshCw, Trash2, Plus, TrendingUp, Shield,
  CheckCircle2, Clock, Eye, X, Check, Database,
  Wifi, WifiOff, ChevronUp, ChevronDown, FileImage, Upload
} from "lucide-react";
import api, { normalizeImage } from "../../utils/api";

const SEV_COLOR = ["#10B981","#F59E0B","#F97316","#EF4444","#7C3AED"];

// ─── Mock fallback data so dashboard is never blank ──────────────────────────
const MOCK_STATS = {
  overview:{ total_patients:15, total_scans:89, total_technicians:3, total_appointments:14,
    pending_queue:4, positive_dr:47, scans_today:8, urgent_cases:3, dr_rate:52.8 },
  monthly_scans:[{month:"Jan",scans:12},{month:"Feb",scans:18},{month:"Mar",scans:22},{month:"Apr",scans:15},{month:"May",scans:25},{month:"Jun",scans:20}],
  severity_distribution:[{name:"No DR",value:6,color:"#10B981"},{name:"Mild DR",value:4,color:"#F59E0B"},{name:"Moderate DR",value:3,color:"#F97316"},{name:"Severe DR",value:1,color:"#EF4444"},{name:"Proliferative DR",value:1,color:"#7C3AED"}],
  technician_performance:[{id:"TECH-001",name:"Ali Hassan",role:"Retinal Imaging Technician",shift:"Morning",email:"ali.hassan@vadr.pk",scans:342,quality:94.2},{id:"TECH-002",name:"Maria Qureshi",role:"Ophthalmic Photographer",shift:"Afternoon",email:"maria.q@vadr.pk",scans:278,quality:96.1},{id:"TECH-003",name:"Kamran Asif",role:"Retinal Imaging Technician",shift:"Morning",email:"kamran.asif@vadr.pk",scans:415,quality:91.8}],
  recent_scans:[]
};
const MOCK_PATIENTS = Array.from({length:15},(_,i)=>({id:`PAT-${1000+i}`,name:["Ahmad Raza","Fatima Khan","Muhammad Ali","Ayesha Malik","Usman Tariq","Zainab Hussain","Bilal Ahmed","Sana Sheikh","Imran Qureshi","Nadia Baig","Hamza Nawaz","Rabia Chaudhry","Tariq Mehmood","Sara Iqbal","Asif Javed"][i],age:40+i*2,gender:i%2===0?"Male":"Female",diabetic_years:i+1,hba1c:parseFloat((6.5+i*0.2).toFixed(1)),blood_pressure:`${120+i*2}/80`,current_severity:["No DR","Mild DR","Moderate DR","Severe DR","Proliferative DR"][i%5],current_severity_index:i%5,last_scan_date:`2025-0${(i%9)+1}-15`}));

const Card = ({children,className=""}) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>{children}</div>
);

function StatCard({icon:Icon,label,value,sub,color,trend,trendUp}){
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div style={{width:42,height:42,borderRadius:12,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon size={20} style={{color}}/>
        </div>
        {trend!=null && (
          <div style={{display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:700,color:trendUp?"#10B981":"#EF4444",background:trendUp?"#ECFDF5":"#FEF2F2",padding:"3px 8px",borderRadius:99}}>
            {trendUp?<ChevronUp size={11}/>:<ChevronDown size={11}/>}{trend}
          </div>
        )}
      </div>
      <p style={{fontSize:28,fontWeight:800,color:"#1E293B",lineHeight:1}}>{value}</p>
      <p style={{fontSize:12,color:"#94A3B8",marginTop:4}}>{label}</p>
      {sub&&<p style={{fontSize:11,color:"#64748B",marginTop:2}}>{sub}</p>}
    </Card>
  );
}

function AddTechModal({onClose,onAdd}){
  const [form,setForm]=useState({name:"",role:"Retinal Imaging Technician",department:"Ophthalmology",shift:"Morning",email:"",phone:""});
  const [loading,setLoading]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async()=>{
    if(!form.name||!form.email) return;
    setLoading(true);
    try{ await api.post("/admin/technicians",form); onAdd(); onClose(); }
    catch(e){ console.error(e); } finally{ setLoading(false); }
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:440,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.2)"}}>
        <div style={{background:"linear-gradient(135deg,#0F4C81,#1a5c96)",padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <p style={{fontSize:16,fontWeight:800,color:"#fff"}}>Add Technician</p>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff"}}><X size={13}/></button>
        </div>
        <div style={{padding:24}}>
          {[["name","Full Name","text",true],["email","Email","email",true],["phone","Phone","text",false],["department","Department","text",false]].map(([k,label,type,req])=>(
            <div key={k} style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>{label}{req?" *":""}</label>
              <input value={form[k]} onChange={e=>set(k,e.target.value)} type={type}
                style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#1E293B",outline:"none",boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor="#3A86FF"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/>
            </div>
          ))}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {[["shift","Shift",["Morning","Afternoon","Night"]],["role","Role",["Retinal Imaging Technician","Ophthalmic Photographer"]]].map(([k,label,opts])=>(
              <div key={k} style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5}}>{label}</label>
                <select value={form[k]} onChange={e=>set(k,e.target.value)} style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"9px 12px",fontSize:12,outline:"none"}}>
                  {opts.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button onClick={submit} disabled={loading||!form.name||!form.email}
            style={{width:"100%",background:loading||!form.name||!form.email?"#94A3B8":"#0F4C81",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading?<><div style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite"}}/>Adding…</>:<><Check size={14}/>Add Technician</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard(){
  const [stats,    setStats]    = useState(MOCK_STATS);
  const [patients, setPatients] = useState(MOCK_PATIENTS);
  const [techs,    setTechs]    = useState(MOCK_STATS.technician_performance);
  const [appts,    setAppts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [dbOnline, setDbOnline] = useState(false);
  const [tab,      setTab]      = useState("overview");
  const [showAdd,  setShowAdd]  = useState(false);
  const [lastRefresh,setLastRefresh]=useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [error,    setError]    = useState(null);

  // ── Normalization test state ───────────────────────────────────────────────
  const [normFile,       setNormFile]       = useState(null);
  const [normPreview,    setNormPreview]    = useState(null);
  const [normLoading,    setNormLoading]    = useState(false);
  const [normResult,     setNormResult]     = useState(null);
  const [normMetrics,    setNormMetrics]    = useState(null);
  const [normError,      setNormError]      = useState(null);
  const normInputRef = React.useRef();

  const handleNormFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setNormFile(f); setNormPreview(URL.createObjectURL(f));
    setNormResult(null); setNormMetrics(null); setNormError(null);
  };
  const resetNorm = () => { setNormFile(null); setNormPreview(null); setNormResult(null); setNormMetrics(null); setNormError(null); };
  const handleNormalize = async () => {
    if (!normFile) return;
    setNormLoading(true); setNormError(null);
    try {
      const data = await normalizeImage(normFile);
      setNormResult(data.normalizedImage);
      setNormMetrics(data.metrics);
    } catch(e) { setNormError(e?.response?.data?.error || e?.message || "Normalization failed."); }
    finally { setNormLoading(false); }
  };

  const load = useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const [s,p,t,a] = await Promise.allSettled([
        api.get("/admin/stats"),
        api.get("/admin/patients"),
        api.get("/admin/technicians"),
        api.get("/admin/appointments"),
      ]);
      if(s.status==="fulfilled" && s.value.data?.overview){ setStats(s.value.data); setDbOnline(true); }
      else { setDbOnline(false); }
      if(p.status==="fulfilled" && p.value.data?.patients?.length){ setPatients(p.value.data.patients); }
      if(t.status==="fulfilled" && t.value.data?.technicians?.length){ setTechs(t.value.data.technicians); }
      if(a.status==="fulfilled"){ setAppts(a.value.data?.appointments||[]); }
      setLastRefresh(new Date());
    } catch(e){ setError("Backend connection failed. Showing demo data."); setDbOnline(false); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ const t=setInterval(load,30000); return()=>clearInterval(t); },[load]);

  const deletePatient = async(id)=>{ try{ await api.delete(`/admin/patients/${id}`); }catch{} setConfirm(null); load(); };
  const deleteTech    = async(id)=>{ try{ await api.delete(`/admin/technicians/${id}`); }catch{} setConfirm(null); load(); };
  const cancelAppt    = async(id)=>{ try{ await api.delete(`/admin/appointments/${id}`); }catch{} setConfirm(null); load(); };

  const ov   = stats?.overview || MOCK_STATS.overview;
  const tabs = [["overview","Overview"],["patients","Patients"],["technicians","Technicians"],["appointments","Appointments"],["normalize","🔬 Normalize"]];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-800">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform management · Users · Appointments · Analytics</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* DB status pill */}
          <div style={{display:"flex",alignItems:"center",gap:6,background:dbOnline?"#ECFDF5":"#FFFBEB",border:`1px solid ${dbOnline?"#BBF7D0":"#FDE68A"}`,borderRadius:99,padding:"5px 12px"}}>
            {dbOnline?<Wifi size={12} style={{color:"#10B981"}}/>:<WifiOff size={12} style={{color:"#F59E0B"}}/>}
            <span style={{fontSize:11,fontWeight:700,color:dbOnline?"#059669":"#D97706"}}>{dbOnline?"MongoDB Live":"Demo Data"}</span>
          </div>
          {lastRefresh&&<p style={{fontSize:11,color:"#94A3B8"}}>Updated {lastRefresh.toLocaleTimeString()}</p>}
          <button onClick={load} style={{display:"flex",alignItems:"center",gap:6,background:"#0F4C81",color:"#fff",border:"none",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            <RefreshCw size={13} style={{animation:loading?"spin 1s linear infinite":"none"}}/>Refresh
          </button>
        </div>
      </div>

      {error&&<div style={{background:"#FFFBEB",border:"1.5px solid #F59E0B",borderRadius:12,padding:"12px 16px",color:"#92400E",fontSize:13}}>⚠ {error}</div>}

      {/* Tabs */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {tabs.map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)}
            style={{fontSize:13,fontWeight:700,padding:"7px 18px",borderRadius:99,border:"none",cursor:"pointer",background:tab===key?"#0F4C81":"#F1F5F9",color:tab===key?"#fff":"#64748B",transition:"all 0.15s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {tab==="overview" && (
        <>
          {/* 8 stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users}         label="Total Patients"    value={ov.total_patients}                 color="#3A86FF" trend="+3 this week" trendUp={true}/>
            <StatCard icon={Eye}           label="Total Scans"       value={ov.total_scans}                    color="#10B981" trend="+12%"         trendUp={true}/>
            <StatCard icon={AlertTriangle} label="Urgent Cases"      value={ov.urgent_cases}                   color="#EF4444" sub="Severe / Proliferative DR"/>
            <StatCard icon={Activity}      label="DR Positive Rate"  value={`${ov.dr_rate}%`}                  color="#F59E0B" sub="of all scans"/>
            <StatCard icon={Camera}        label="Technicians"       value={ov.total_technicians}              color="#7C3AED"/>
            <StatCard icon={Calendar}      label="Appointments"      value={ov.total_appointments}             color="#0F4C81"/>
            <StatCard icon={Clock}         label="Queue Pending"     value={ov.pending_queue}                  color="#F97316" sub="awaiting processing"/>
            <StatCard icon={CheckCircle2}  label="Scans Today"       value={ov.scans_today}                    color="#10B981" sub="processed today"/>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Monthly bar chart */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div><p className="font-bold text-slate-800" style={{fontSize:15}}>Monthly Scan Activity</p><p className="text-xs text-slate-400">Scans processed over last 6 months</p></div>
                <TrendingUp size={18} style={{color:"#3A86FF"}}/>
              </div>
              {stats.monthly_scans?.length>0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.monthly_scans} margin={{top:4,right:4,left:-24,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                    <XAxis dataKey="month" tick={{fontSize:11,fill:"#94A3B8"}}/>
                    <YAxis tick={{fontSize:11,fill:"#94A3B8"}}/>
                    <Tooltip formatter={v=>[`${v} scans`,"Scans"]} contentStyle={{borderRadius:10,border:"1px solid #E2E8F0",fontSize:12}}/>
                    <Bar dataKey="scans" radius={[5,5,0,0]}>
                      {stats.monthly_scans.map((_,i)=><Cell key={i} fill={i===stats.monthly_scans.length-1?"#3A86FF":"#0F4C81"}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"#94A3B8"}}>No scan data yet</div>}
            </Card>

            {/* Severity donut */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div><p className="font-bold text-slate-800" style={{fontSize:15}}>Patient Severity Mix</p><p className="text-xs text-slate-400">Current DR stage across all patients</p></div>
                <Shield size={18} style={{color:"#7C3AED"}}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={stats.severity_distribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                      {stats.severity_distribution.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip formatter={(v,n)=>[`${v} patients`,n]} contentStyle={{borderRadius:10,fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {stats.severity_distribution.map((s,i)=>(
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{width:9,height:9,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                        <span style={{fontSize:11,color:"#64748B"}}>{s.name}</span>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:"#334155"}}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Technician performance table */}
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div><p className="font-bold text-slate-800" style={{fontSize:15}}>Technician Performance</p><p className="text-xs text-slate-400">Total scans &amp; average AI confidence per technician</p></div>
              <Camera size={16} style={{color:"#3A86FF"}}/>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>
                  {["Technician","Role","Shift","Total Scans","Quality Score","Status"].map(h=>(
                    <th key={h} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 16px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(stats.technician_performance||[]).map((t,i)=>(
                    <tr key={i} style={{borderTop:"1px solid #F1F5F9"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"13px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#0F4C81,#3A86FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>
                            {t.name?.split(" ").map(n=>n[0]).join("")}
                          </div>
                          <div>
                            <p style={{fontSize:13,fontWeight:600,color:"#1E293B"}}>{t.name}</p>
                            <p style={{fontSize:10,color:"#94A3B8"}}>{t.email||t.id}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:"13px 16px",fontSize:11,color:"#64748B"}}>{t.role}</td>
                      <td style={{padding:"13px 16px"}}><span style={{fontSize:10,fontWeight:700,color:"#3A86FF",background:"#EAF4FF",padding:"3px 10px",borderRadius:99}}>{t.shift}</span></td>
                      <td style={{padding:"13px 16px",fontSize:15,fontWeight:800,color:"#0F4C81"}}>{t.scans}</td>
                      <td style={{padding:"13px 16px",minWidth:160}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,background:"#E2E8F0",borderRadius:99,height:7}}>
                            <div style={{width:`${t.quality}%`,background:t.quality>=95?"#10B981":t.quality>=90?"#F59E0B":"#EF4444",borderRadius:99,height:7,transition:"width 0.6s ease"}}/>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:"#334155",width:40}}>{t.quality}%</span>
                        </div>
                      </td>
                      <td style={{padding:"13px 16px"}}><span style={{fontSize:10,fontWeight:700,color:"#10B981",background:"#ECFDF5",padding:"3px 10px",borderRadius:99}}>Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent scans live feed */}
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div><p className="font-bold text-slate-800" style={{fontSize:15}}>Recent Scan Activity</p><p className="text-xs text-slate-400">Latest retinal assessments across all technicians</p></div>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#10B981",boxShadow:"0 0 0 3px #ECFDF5",animation:"pulse 2s infinite"}}/>
            </div>
            {stats.recent_scans?.length>0 ? (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"#F8FAFC"}}>
                    {["Scan ID","Patient","Date","Eye","Severity","Confidence","Technician"].map(h=>(
                      <th key={h} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 16px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {stats.recent_scans.map((s,i)=>{
                      const sc=SEV_COLOR[s.severity_index]||"#94A3B8";
                      return (
                        <tr key={i} style={{borderTop:"1px solid #F1F5F9"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"11px 16px",fontSize:11,fontFamily:"monospace",color:"#3A86FF",fontWeight:600}}>{s.id||"—"}</td>
                          <td style={{padding:"11px 16px",fontSize:12,fontWeight:500,color:"#334155"}}>{s.patient_name}</td>
                          <td style={{padding:"11px 16px",fontSize:11,color:"#94A3B8"}}>{s.date}</td>
                          <td style={{padding:"11px 16px",fontSize:11,color:"#64748B"}}>{s.eye}</td>
                          <td style={{padding:"11px 16px"}}><span style={{background:`${sc}15`,color:sc,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{s.severity}</span></td>
                          <td style={{padding:"11px 16px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:50,background:"#E2E8F0",borderRadius:99,height:5}}><div style={{width:`${s.confidence}%`,background:sc,borderRadius:99,height:5}}/></div>
                              <span style={{fontSize:11,fontWeight:700,color:"#334155"}}>{s.confidence}%</span>
                            </div>
                          </td>
                          <td style={{padding:"11px 16px",fontSize:11,color:"#64748B"}}>{s.technician_id}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{padding:"32px",textAlign:"center",color:"#94A3B8"}}>
                <Database size={28} style={{margin:"0 auto 10px",opacity:0.4}}/>
                <p style={{fontSize:13,marginBottom:4}}>No scans recorded yet</p>
                <p style={{fontSize:11}}>Scans will appear here once technicians start processing</p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ══ PATIENTS ══════════════════════════════════════════════════════════ */}
      {tab==="patients" && (
        <Card className="overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div><p className="font-bold text-slate-800" style={{fontSize:15}}>All Patients ({patients.length})</p><p className="text-xs text-slate-400">Registered patient records</p></div>
            <Users size={16} style={{color:"#3A86FF"}}/>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#F8FAFC"}}>
                {["Patient","Age","Gender","Diabetic Yrs","HbA1c","Current DR","Last Scan","Action"].map(h=>(
                  <th key={h} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 14px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {patients.map((p,i)=>{
                  const si=p.current_severity_index??0; const sc=SEV_COLOR[si];
                  return (
                    <tr key={i} style={{borderTop:"1px solid #F1F5F9"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"12px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:9}}>
                          <div style={{width:33,height:33,borderRadius:"50%",background:`linear-gradient(135deg,${sc},${sc}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>
                            {p.name?.split(" ").map(n=>n[0]).join("")}
                          </div>
                          <div>
                            <p style={{fontSize:12.5,fontWeight:600,color:"#1E293B"}}>{p.name}</p>
                            <p style={{fontSize:10,color:"#94A3B8"}}>{p.id}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#334155"}}>{p.age}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#334155"}}>{p.gender}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:"#334155"}}>{p.diabetic_years} yrs</td>
                      <td style={{padding:"12px 14px"}}>
                        <span style={{fontSize:12,fontWeight:700,color:p.hba1c<7?"#10B981":p.hba1c<8?"#F59E0B":"#EF4444"}}>{p.hba1c}%</span>
                      </td>
                      <td style={{padding:"12px 14px"}}>
                        <span style={{background:`${sc}15`,color:sc,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{p.current_severity}</span>
                      </td>
                      <td style={{padding:"12px 14px",fontSize:11,color:"#94A3B8"}}>{p.last_scan_date||"—"}</td>
                      <td style={{padding:"12px 14px"}}>
                        <button onClick={()=>setConfirm({type:"patient",id:p.id,name:p.name})}
                          style={{background:"#FEF2F2",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,color:"#EF4444",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                          <Trash2 size={11}/>Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ══ TECHNICIANS ═══════════════════════════════════════════════════════ */}
      {tab==="technicians" && (
        <Card className="overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div><p className="font-bold text-slate-800" style={{fontSize:15}}>Technicians ({techs.length})</p><p className="text-xs text-slate-400">Imaging staff management</p></div>
            <button onClick={()=>setShowAdd(true)} style={{display:"flex",alignItems:"center",gap:6,background:"#0F4C81",color:"#fff",border:"none",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              <Plus size={13}/>Add Technician
            </button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#F8FAFC"}}>
                {["Name","Role","Shift","Email","Total Scans","Quality","Action"].map(h=>(
                  <th key={h} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 14px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {techs.map((t,i)=>(
                  <tr key={i} style={{borderTop:"1px solid #F1F5F9"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#0F4C81,#3A86FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>
                          {t.name?.split(" ").map(n=>n[0]).join("")}
                        </div>
                        <p style={{fontSize:12.5,fontWeight:600,color:"#1E293B"}}>{t.name}</p>
                      </div>
                    </td>
                    <td style={{padding:"12px 14px",fontSize:11,color:"#64748B"}}>{t.role}</td>
                    <td style={{padding:"12px 14px"}}><span style={{fontSize:10,fontWeight:700,color:"#3A86FF",background:"#EAF4FF",padding:"3px 10px",borderRadius:99}}>{t.shift}</span></td>
                    <td style={{padding:"12px 14px",fontSize:11,color:"#64748B"}}>{t.email}</td>
                    <td style={{padding:"12px 14px",fontSize:15,fontWeight:800,color:"#0F4C81"}}>{t.scans||t.total_scans||0}</td>
                    <td style={{padding:"12px 14px",minWidth:130}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{flex:1,background:"#E2E8F0",borderRadius:99,height:6}}><div style={{width:`${t.quality||t.avg_quality||0}%`,background:"#10B981",borderRadius:99,height:6}}/></div>
                        <span style={{fontSize:11,fontWeight:700,color:"#334155"}}>{t.quality||t.avg_quality||0}%</span>
                      </div>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <button onClick={()=>setConfirm({type:"technician",id:t.id||t._id,name:t.name})}
                        style={{background:"#FEF2F2",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,color:"#EF4444",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                        <Trash2 size={11}/>Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ══ APPOINTMENTS ══════════════════════════════════════════════════════ */}
      {tab==="appointments" && (
        <Card className="overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div><p className="font-bold text-slate-800" style={{fontSize:15}}>All Appointments ({appts.length})</p><p className="text-xs text-slate-400">Scheduled and upcoming sessions across all patients</p></div>
            <Calendar size={16} style={{color:"#3A86FF"}}/>
          </div>
          {appts.length>0 ? (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>
                  {["Patient","Technician","Date","Time","Type","Status","Action"].map(h=>(
                    <th key={h} style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 14px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {appts.map((a,i)=>{
                    const sc=a.status==="cancelled"?"#EF4444":a.status==="confirmed"?"#10B981":"#F59E0B";
                    const sb=a.status==="cancelled"?"#FEF2F2":a.status==="confirmed"?"#ECFDF5":"#FFFBEB";
                    return (
                      <tr key={i} style={{borderTop:"1px solid #F1F5F9"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"12px 14px",fontSize:12.5,fontWeight:600,color:"#1E293B"}}>{a.patient_name}</td>
                        <td style={{padding:"12px 14px",fontSize:11,color:"#64748B"}}>{a.technician_id}</td>
                        <td style={{padding:"12px 14px",fontSize:12,color:"#334155"}}>{a.date}</td>
                        <td style={{padding:"12px 14px",fontSize:12,color:"#334155"}}>{a.time}</td>
                        <td style={{padding:"12px 14px",fontSize:11,color:"#64748B"}}>{a.type}</td>
                        <td style={{padding:"12px 14px"}}><span style={{background:sb,color:sc,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{a.status}</span></td>
                        <td style={{padding:"12px 14px"}}>
                          {a.status!=="cancelled"&&(
                            <button onClick={()=>setConfirm({type:"appointment",id:a.id,name:`${a.patient_name}'s appointment`})}
                              style={{background:"#FEF2F2",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,color:"#EF4444",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                              <X size={11}/>Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{padding:"40px",textAlign:"center",color:"#94A3B8"}}>
              <Calendar size={28} style={{margin:"0 auto 10px",opacity:0.4}}/>
              <p style={{fontSize:13,marginBottom:4}}>No appointments yet</p>
              <p style={{fontSize:11}}>Appointments booked by patients will appear here</p>
            </div>
          )}
        </Card>
      )}

      {/* ══ NORMALIZE TAB ════════════════════════════════════════════════════ */}
      {tab==="normalize" && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div style={{width:40,height:40,borderRadius:12,background:"#EAF4FF",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Activity size={20} style={{color:"#0F4C81"}}/>
            </div>
            <div>
              <p className="font-bold text-slate-800">Image Normalization Module</p>
              <p className="text-xs text-slate-400">Test the 7-step preprocessing pipeline on any fundus image</p>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {/* Upload */}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2">Upload Fundus Image</label>
              <div
                onClick={()=>!normFile&&normInputRef.current?.click()}
                style={{border:`2px dashed ${normFile?"#10B981":"#CBD5E1"}`,borderRadius:14,padding:normFile?12:30,textAlign:"center",background:normFile?"#F0FDF4":"#F8FAFC",cursor:normFile?"default":"pointer",marginBottom:12}}>
                <input ref={normInputRef} type="file" accept=".jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>{ if(e.target.files[0]) handleNormFile(e.target.files[0]); }}/>
                {!normFile ? (
                  <>
                    <div style={{width:44,height:44,borderRadius:12,background:"#EAF4FF",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><FileImage size={20} style={{color:"#0F4C81"}}/></div>
                    <p style={{fontSize:13,fontWeight:600,color:"#334155",marginBottom:4}}>Click to select fundus image</p>
                    <p style={{fontSize:11,color:"#94A3B8"}}>JPG or PNG</p>
                  </>
                ) : (
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <img src={normPreview} alt="preview" style={{width:60,height:60,borderRadius:10,objectFit:"cover",border:"2px solid #10B981",flexShrink:0}}/>
                    <div style={{flex:1,textAlign:"left"}}>
                      <p style={{fontSize:12,fontWeight:600,color:"#1E293B"}}>{normFile.name}</p>
                      <p style={{fontSize:10,color:"#94A3B8"}}>{(normFile.size/1024/1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={e=>{e.stopPropagation();resetNorm();}} style={{background:"#FEF2F2",border:"none",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={12} style={{color:"#EF4444"}}/></button>
                  </div>
                )}
              </div>

              {normError && <p style={{fontSize:12,color:"#EF4444",background:"#FEF2F2",borderRadius:10,padding:"8px 12px",marginBottom:10}}>⚠ {normError}</p>}

              {!normResult && (
                <button onClick={handleNormalize} disabled={!normFile||normLoading}
                  style={{width:"100%",background:!normFile||normLoading?"#94A3B8":"#0F4C81",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,cursor:!normFile||normLoading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {normLoading
                    ? <><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite"}}/>Normalizing…</>
                    : <><Activity size={15}/>Run Normalization Pipeline</>}
                </button>
              )}

              {/* Pipeline steps */}
              <div style={{marginTop:16,background:"#F8FAFC",borderRadius:12,padding:"12px 14px"}}>
                <p style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8}}>7-STEP PIPELINE</p>
                {["Resize to 224×224","Color Normalization","Brightness / Gamma","CLAHE Enhancement","Noise Reduction","Intensity Standardization","Save to MongoDB"].map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"#0F4C81",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{i+1}</span>
                    </div>
                    <p style={{fontSize:11,color:"#475569"}}>{s}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Result */}
            <div>
              {!normResult ? (
                <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#F8FAFC",borderRadius:14,border:"2px dashed #E2E8F0",flexDirection:"column",gap:8,minHeight:300}}>
                  <FileImage size={32} style={{color:"#CBD5E1"}}/>
                  <p style={{fontSize:13,color:"#94A3B8",fontWeight:600}}>Normalized image appears here</p>
                </div>
              ) : (
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <CheckCircle2 size={18} style={{color:"#10B981"}}/>
                    <p style={{fontSize:13,fontWeight:700,color:"#1E293B"}}>Normalization Complete</p>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    <div style={{textAlign:"center"}}>
                      <p style={{fontSize:10,color:"#94A3B8",fontWeight:600,marginBottom:5}}>ORIGINAL</p>
                      <img src={normPreview} alt="original" style={{width:"100%",height:130,objectFit:"cover",borderRadius:10,border:"1.5px solid #E2E8F0"}}/>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <p style={{fontSize:10,color:"#059669",fontWeight:600,marginBottom:5}}>NORMALIZED</p>
                      <img src={normResult} alt="normalized" style={{width:"100%",height:130,objectFit:"cover",borderRadius:10,border:"1.5px solid #10B981"}}/>
                    </div>
                  </div>
                  {normMetrics && (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                      {[["Brightness",normMetrics.brightnessScore?.toFixed(3)],["Contrast",normMetrics.contrastScore?.toFixed(3)],["Time",`${normMetrics.processingTime}s`]].map(([l,v])=>(
                        <div key={l} style={{background:"#F8FAFC",borderRadius:10,padding:"8px",textAlign:"center",border:"1px solid #E2E8F0"}}>
                          <p style={{fontSize:10,color:"#94A3B8"}}>{l}</p>
                          <p style={{fontSize:14,fontWeight:800,color:"#1E293B"}}>{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {normMetrics && (
                    <div style={{background:"#F0FDF4",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                      <p style={{fontSize:11,fontWeight:700,color:"#059669",marginBottom:6}}>Pipeline Metrics</p>
                      {[["Gamma Correction",normMetrics.gammaCorrection],["Mean Intensity",normMetrics.meanIntensity?.toFixed(4)],["Std Intensity",normMetrics.stdIntensity?.toFixed(4)]].map(([l,v])=>(
                        <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:11,color:"#475569"}}>{l}</span>
                          <span style={{fontSize:11,fontWeight:700,color:"#1E293B"}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={resetNorm} style={{width:"100%",background:"#F1F5F9",border:"none",borderRadius:10,padding:"10px",fontSize:12,fontWeight:700,color:"#334155",cursor:"pointer"}}>
                    Test Another Image
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Add Tech Modal */}
      {showAdd&&<AddTechModal onClose={()=>setShowAdd(false)} onAdd={load}/>}

      {/* Confirm Dialog */}
      {confirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div style={{background:"#fff",borderRadius:20,maxWidth:380,width:"100%",padding:28,boxShadow:"0 24px 80px rgba(0,0,0,0.2)"}}>
            <div style={{width:52,height:52,borderRadius:16,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><Trash2 size={24} style={{color:"#EF4444"}}/></div>
            <p style={{fontSize:16,fontWeight:800,color:"#1E293B",textAlign:"center",marginBottom:8}}>Confirm Action</p>
            <p style={{fontSize:13,color:"#64748B",textAlign:"center",marginBottom:24}}>{confirm.type==="appointment"?"Cancel":"Remove"} <strong>{confirm.name}</strong>? This cannot be undone.</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirm(null)} style={{flex:1,background:"#F1F5F9",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:600,color:"#334155",cursor:"pointer"}}>Go Back</button>
              <button onClick={()=>{ if(confirm.type==="patient") deletePatient(confirm.id); else if(confirm.type==="technician") deleteTech(confirm.id); else cancelAppt(confirm.id); }}
                style={{flex:1,background:"#EF4444",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                {confirm.type==="appointment"?"Cancel Appointment":"Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
