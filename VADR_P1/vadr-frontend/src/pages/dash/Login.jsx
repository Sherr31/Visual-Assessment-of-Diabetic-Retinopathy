import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Stethoscope, User, Camera, Shield, AlertCircle, Activity } from "lucide-react";

const ROLES = [
  { key:"doctor",     label:"Doctor",     subtitle:"Ophthalmologist / Physician",   icon:Stethoscope, gradient:"linear-gradient(135deg,#0F4C81,#1a6bb5)", accent:"#60a5fa", credentials:[{user:"dr.rahman",pass:"doctor123"},{user:"admin",pass:"admin"}], redirectTo:"/dash/overview",          description:"Access full DR assessment dashboard, AI analytics, and patient records." },
  { key:"patient",    label:"Patient",    subtitle:"Personal Health Portal",        icon:User,        gradient:"linear-gradient(135deg,#10B981,#059669)", accent:"#34d399", credentials:[{user:"patient",pass:"patient123"},{user:"ahmad.raza",pass:"pass123"}],  redirectTo:"/dash/patient-dashboard", description:"View retinal scan results, DR history, upload scans, and book appointments." },
  { key:"technician", label:"Technician", subtitle:"Imaging Console",               icon:Camera,      gradient:"linear-gradient(135deg,#7C3AED,#6d28d9)", accent:"#a78bfa", credentials:[{user:"tech.ali",pass:"tech123"},{user:"technician",pass:"tech123"}],    redirectTo:"/dash/tech-dashboard",    description:"Manage scan queue, upload retinal images, and process AI results." },
  { key:"admin",      label:"Admin",      subtitle:"Platform Management",           icon:Shield,      gradient:"linear-gradient(135deg,#EF4444,#dc2626)", accent:"#fca5a5", credentials:[{user:"admin",pass:"admin@vadr"},{user:"superadmin",pass:"super123"}],   redirectTo:"/dash/admin",             description:"Manage all users, technicians, appointments, and platform analytics." },
];

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [step,     setStep]     = useState("role");
  const [role,     setRole]     = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const selectRole=(r)=>{ setRole(r); setStep("form"); setError(""); setUsername(""); setPassword(""); };

  const handleLogin=async(e)=>{
    e.preventDefault(); setError(""); setLoading(true);
    await new Promise(r=>setTimeout(r,800));
    const valid=role.credentials.some(c=>c.user===username.trim()&&c.pass===password);
    if(valid){ onLogin({role:role.key,username,name:username}); navigate(role.redirectTo); }
    else setError("Invalid username or password. Check demo credentials below.");
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh",background:"linear-gradient(135deg,#0a1628 0%,#0F4C81 50%,#1a2942 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",top:-120,right:-120,width:400,height:400,borderRadius:"50%",background:"rgba(58,134,255,0.07)",pointerEvents:"none" }}/>
      <div style={{ position:"absolute",bottom:-80,left:-80,width:300,height:300,borderRadius:"50%",background:"rgba(16,185,129,0.05)",pointerEvents:"none" }}/>

      <div style={{ width:"100%",maxWidth:step==="role"?920:440,transition:"max-width 0.4s ease" }}>
        {/* Logo */}
        <div style={{ textAlign:"center",marginBottom:36 }}>
          <div style={{ width:64,height:64,borderRadius:20,background:"rgba(255,255,255,0.12)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",border:"1.5px solid rgba(255,255,255,0.2)" }}>
            <Activity size={32} style={{ color:"#fff" }}/>
          </div>
          <h1 style={{ fontSize:28,fontWeight:800,color:"#fff",marginBottom:5,letterSpacing:"-0.5px" }}>VADR Platform</h1>
          <p style={{ fontSize:13,color:"rgba(255,255,255,0.5)" }}>Visual Assessment for Diabetic Retinopathy</p>
        </div>

        {/* Role Selection */}
        {step==="role"&&(
          <div>
            <p style={{ textAlign:"center",fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:22 }}>Select your role to continue</p>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14 }}>
              {ROLES.map(r=>{
                const Icon=r.icon;
                return (
                  <button key={r.key} onClick={()=>selectRole(r)}
                    style={{ background:"rgba(255,255,255,0.07)",backdropFilter:"blur(12px)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"24px 20px",cursor:"pointer",textAlign:"left",transition:"all 0.2s ease" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.13)"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.25)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.07)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.12)"; }}>
                    <div style={{ width:48,height:48,borderRadius:14,background:r.gradient,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14 }}><Icon size={22} style={{ color:"#fff" }}/></div>
                    <p style={{ fontSize:17,fontWeight:800,color:"#fff",marginBottom:3 }}>{r.label}</p>
                    <p style={{ fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:10 }}>{r.subtitle}</p>
                    <p style={{ fontSize:11,color:"rgba(255,255,255,0.55)",lineHeight:1.6 }}>{r.description}</p>
                    <div style={{ marginTop:14,display:"flex",alignItems:"center",gap:5 }}>
                      <span style={{ fontSize:11,fontWeight:600,color:r.accent }}>Sign in →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Login Form */}
        {step==="form"&&role&&(
          <div style={{ background:"rgba(255,255,255,0.07)",backdropFilter:"blur(16px)",border:"1.5px solid rgba(255,255,255,0.14)",borderRadius:24,overflow:"hidden" }}>
            <div style={{ background:role.gradient,padding:"22px 26px",display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:44,height:44,borderRadius:13,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><role.icon size={20} style={{ color:"#fff" }}/></div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:17,fontWeight:800,color:"#fff" }}>{role.label} Login</p>
                <p style={{ fontSize:11,color:"rgba(255,255,255,0.65)" }}>{role.subtitle}</p>
              </div>
              <button onClick={()=>setStep("role")} style={{ background:"rgba(255,255,255,0.18)",border:"none",borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer" }}>← Back</button>
            </div>
            <form onSubmit={handleLogin} style={{ padding:26 }}>
              {[["Username",username,setUsername,"text",`e.g. ${role.credentials[0].user}`],["Password",password,setPassword,showPw?"text":"password","••••••••"]].map(([label,val,setter,type,ph],i)=>(
                <div key={label} style={{ marginBottom:15 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.65)",marginBottom:5 }}>{label}</label>
                  <div style={{ position:"relative" }}>
                    <input value={val} onChange={e=>setter(e.target.value)} required type={type} placeholder={ph}
                      style={{ width:"100%",background:"rgba(255,255,255,0.1)",border:"1.5px solid rgba(255,255,255,0.15)",borderRadius:11,padding:i===1?"11px 42px 11px 14px":"11px 14px",fontSize:13,color:"#fff",outline:"none",boxSizing:"border-box" }}
                      onFocus={e=>e.target.style.borderColor="rgba(255,255,255,0.4)"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"}/>
                    {i===1&&<button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(255,255,255,0.45)",cursor:"pointer" }}>{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button>}
                  </div>
                </div>
              ))}
              {error&&(
                <div style={{ background:"rgba(239,68,68,0.15)",border:"1.5px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"9px 13px",marginBottom:14,display:"flex",alignItems:"flex-start",gap:7 }}>
                  <AlertCircle size={13} style={{ color:"#EF4444",flexShrink:0,marginTop:1 }}/>
                  <p style={{ fontSize:12,color:"#FCA5A5",lineHeight:1.5 }}>{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{ width:"100%",background:loading?"rgba(255,255,255,0.15)":role.gradient,border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,color:"#fff",cursor:loading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                {loading?<><div style={{ width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.8s linear infinite" }}/>Authenticating…</>:`Sign in as ${role.label}`}
              </button>
              <div style={{ marginTop:18,padding:"12px 14px",background:"rgba(255,255,255,0.05)",borderRadius:11,border:"1px dashed rgba(255,255,255,0.13)" }}>
                <p style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:7 }}>Demo Credentials</p>
                {role.credentials.map((c,i)=>(
                  <div key={i} style={{ display:"flex",gap:14,fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:i<role.credentials.length-1?3:0 }}>
                    <span>User: <strong style={{ color:"rgba(255,255,255,0.8)" }}>{c.user}</strong></span>
                    <span>Pass: <strong style={{ color:"rgba(255,255,255,0.8)" }}>{c.pass}</strong></span>
                  </div>
                ))}
              </div>
            </form>
          </div>
        )}
        <p style={{ textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:22 }}>VADR Platform v2.4 · RetinaNet AI · © 2025</p>
        <p style={{ textAlign:"center",fontSize:11,marginTop:8 }}>
          <a href="/login" style={{ color:"rgba(255,255,255,0.35)",textDecoration:"none" }}>
            ← Staff / JWT login
          </a>
        </p>
      </div>
    </div>
  );
}
