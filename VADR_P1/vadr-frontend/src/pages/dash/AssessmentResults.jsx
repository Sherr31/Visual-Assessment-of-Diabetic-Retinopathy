/**
 * AssessmentResults.jsx
 * Merged: v8 layout + severity summary cards + VADR DrDashboard's
 * anatomical RetinaSVG viewer, confidence arc gauge, and detected-findings panel.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchHistory } from "../../utils/api";
import SeverityBadge from "../../components/Dashboard/SeverityBadge";
import { Eye, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

const SEV_COLORS = ["#10B981","#F59E0B","#F97316","#EF4444","#7C3AED"];
const SEV_LABELS = ["No DR","Mild DR","Moderate DR","Severe DR","Proliferative DR"];

const SEV_META = {
  "No DR":           { color:"#10B981", bg:"rgba(16,185,129,0.1)",  icon:CheckCircle2, label:"No Diabetic Retinopathy", risk:"Low"      },
  "Mild DR":         { color:"#F59E0B", bg:"rgba(245,158,11,0.1)",  icon:Info,          label:"Mild NPDR",              risk:"Low–Mod"  },
  "Moderate DR":     { color:"#F97316", bg:"rgba(249,115,22,0.1)",  icon:AlertTriangle, label:"Moderate NPDR",          risk:"Moderate" },
  "Severe DR":       { color:"#EF4444", bg:"rgba(239,68,68,0.1)",   icon:XCircle,       label:"Severe NPDR",            risk:"High"     },
  "Proliferative DR":{ color:"#7C3AED", bg:"rgba(124,58,237,0.1)", icon:XCircle,       label:"Proliferative DR",       risk:"Very High"},
};

// ── VADR Retina SVG viewer (merged from DrDashboard.jsx) ─────────────────────
function RetinaSVG({ severity }) {
  const si = SEV_LABELS.indexOf(severity);
  const hasLesions = si >= 1;
  const isMod      = si >= 2;
  const isAdv      = si >= 3;
  return (
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" style={{ width:"100%",height:"100%",display:"block" }}>
      <defs>
        <radialGradient id="rBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#7B1818"/>
          <stop offset="45%"  stopColor="#5A0F0F"/>
          <stop offset="75%"  stopColor="#3D0A0A"/>
          <stop offset="100%" stopColor="#1E0505"/>
        </radialGradient>
        <radialGradient id="rDisc" cx="40%" cy="40%" r="55%">
          <stop offset="0%"   stopColor="#FFFBF0"/>
          <stop offset="55%"  stopColor="#FFE58C"/>
          <stop offset="100%" stopColor="#E8B84B"/>
        </radialGradient>
        <radialGradient id="rMac" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#100303"/>
          <stop offset="100%" stopColor="#2A0707"/>
        </radialGradient>
        <clipPath id="rClip"><circle cx="150" cy="150" r="144"/></clipPath>
      </defs>
      <circle cx="150" cy="150" r="145" fill="url(#rBg)"/>
      <circle cx="150" cy="150" r="95" fill="none" stroke="rgba(110,25,25,0.12)" strokeWidth="38"/>
      <g clipPath="url(#rClip)">
        <path d="M148 148 C170 128,202 103,247 63"  stroke="#9B0000" strokeWidth="2.8" fill="none" opacity="0.85"/>
        <path d="M149 150 C173 130,205 106,249 66"  stroke="#C00000" strokeWidth="1.4" fill="none" opacity="0.6"/>
        <path d="M200 103 C222 86,246 80,266 88"    stroke="#9B0000" strokeWidth="1.4" fill="none" opacity="0.65"/>
        <path d="M148 152 C172 174,206 198,253 240" stroke="#9B0000" strokeWidth="2.8" fill="none" opacity="0.85"/>
        <path d="M148 150 C174 172,208 196,255 237" stroke="#C00000" strokeWidth="1.4" fill="none" opacity="0.6"/>
        <path d="M205 198 C228 214,252 213,270 205" stroke="#9B0000" strokeWidth="1.4" fill="none" opacity="0.65"/>
        <path d="M148 148 C128 128,100 104,63 68"   stroke="#9B0000" strokeWidth="2.2" fill="none" opacity="0.75"/>
        <path d="M100 104 C80 87,57 84,38 90"       stroke="#9B0000" strokeWidth="1.2" fill="none" opacity="0.55"/>
        <path d="M148 152 C125 174,95 198,58 237"   stroke="#9B0000" strokeWidth="2.2" fill="none" opacity="0.75"/>
        <path d="M95  198 C73 214,50 212,36 205"    stroke="#9B0000" strokeWidth="1.2" fill="none" opacity="0.55"/>
        <path d="M148 150 C168 148,187 148,197 150" stroke="#9B0000" strokeWidth="1.6" fill="none" opacity="0.65"/>
        <path d="M175 117 C189 107,202 107,214 114" stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.55"/>
        <path d="M180 177 C193 187,207 184,220 177" stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.55"/>
        <path d="M115 117 C101 107,88 109,80 117"   stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.48"/>
        <path d="M110 180 C98 190,85 187,76 178"    stroke="#7A0000" strokeWidth="0.8" fill="none" opacity="0.48"/>
        {hasLesions && (<>
          <circle cx="188" cy="133" r="2.5" fill="#CC0000" opacity="0.9"/>
          <circle cx="172" cy="169" r="2"   fill="#CC0000" opacity="0.85"/>
          <circle cx="223" cy="155" r="3"   fill="#990000" opacity="0.8"/>
          <circle cx="163" cy="119" r="2"   fill="#CC0000" opacity="0.9"/>
          <circle cx="239" cy="139" r="2.5" fill="#CC0000" opacity="0.85"/>
          <circle cx="199" cy="143" r="3.5" fill="#FFF8DC" opacity="0.62"/>
          <circle cx="214" cy="161" r="2.5" fill="#FFFFF0" opacity="0.58"/>
          <circle cx="184" cy="158" r="2"   fill="#FFF8DC" opacity="0.62"/>
        </>)}
        {isMod && (<>
          <ellipse cx="170" cy="122" rx="7"  ry="4.5" fill="#7A0000" opacity="0.5"/>
          <ellipse cx="229" cy="169" rx="6"  ry="4"   fill="#7A0000" opacity="0.46"/>
          <circle  cx="206" cy="148" r="2.5" fill="#FFFACD" opacity="0.68"/>
          <circle  cx="209" cy="156" r="2"   fill="#FFF8DC" opacity="0.64"/>
          <ellipse cx="175" cy="132" rx="8"  ry="5.5" fill="rgba(238,238,218,0.38)"/>
          <ellipse cx="219" cy="176" rx="7"  ry="4.5" fill="rgba(238,238,218,0.34)"/>
        </>)}
        {isAdv && (<>
          <path d="M148 145 C137 124,124 114,114 107" stroke="#FF8080" strokeWidth="1.5" fill="none" opacity="0.7"/>
          <ellipse cx="185" cy="127" rx="14" ry="9"  fill="#660000" opacity="0.5"/>
          <ellipse cx="236" cy="173" rx="11" ry="7"  fill="#660000" opacity="0.46"/>
          <circle  cx="243" cy="120" r="5"   fill="#880000" opacity="0.62"/>
          <circle  cx="178" cy="192" r="4"   fill="#880000" opacity="0.58"/>
        </>)}
      </g>
      <circle cx="150" cy="150" r="23" fill="url(#rDisc)"/>
      <circle cx="150" cy="150" r="19" fill="#FFF5D6" opacity="0.82"/>
      <circle cx="150" cy="150" r="12" fill="#FFFBF0" opacity="0.72"/>
      <circle cx="150" cy="150" r="23" fill="none" stroke="#E8A030" strokeWidth="1.5" opacity="0.45"/>
      <ellipse cx="216" cy="150" rx="19" ry="16" fill="url(#rMac)" opacity="0.62"/>
      <circle  cx="216" cy="150" r="5"  fill="#0A0202" opacity="0.88"/>
      <circle  cx="150" cy="150" r="145" fill="none" stroke="rgba(0,0,0,0.55)"    strokeWidth="4"/>
      <circle  cx="150" cy="150" r="143" fill="none" stroke="rgba(80,20,20,0.18)" strokeWidth="6"/>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AssessmentResults() {
  const [records,  setRecords]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetchHistory()
      .then(d => {
        const recs = d.records || [];
        setRecords(recs);
        setSelected(recs[0] || null);
      })
      .catch(() => { setRecords(MOCK); setSelected(MOCK[0]); })
      .finally(() => setLoading(false));
  }, []);

  const summary = SEV_LABELS.map((label, i) => ({
    label, count: records.filter(r => r.severity_index === i).length, color: SEV_COLORS[i]
  }));

  const sevMeta = selected ? (SEV_META[selected.severity] || SEV_META["No DR"]) : null;
  const SevIcon = sevMeta?.icon || CheckCircle2;

  const findings = selected ? [
    { label:"Microaneurysms", present: (selected.severity_index||0) >= 1, score: 0.82 },
    { label:"Hard Exudates",  present: (selected.severity_index||0) >= 2, score: 0.74 },
    { label:"Hemorrhages",    present: (selected.severity_index||0) >= 2, score: 0.61 },
    { label:"Neovascularisation", present: (selected.severity_index||0) >= 4, score: 0.89 },
    { label:"Macular Edema",  present: (selected.severity_index||0) >= 3, score: 0.76 },
  ] : [];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Severity summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {summary.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.08 }}
            className="card text-center cursor-pointer hover:shadow-card-hover"
            style={{ borderTop:`3px solid ${s.color}` }}>
            <p className="text-3xl font-display font-bold" style={{ color:s.color }}>{s.count}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: record list ──────────────────────────────────────── */}
        <div className="xl:col-span-1 card max-h-[680px] overflow-y-auto">
          <h2 className="font-display font-bold text-gray-900 mb-4">All Assessments</h2>
          <div className="space-y-2">
            {records.map((r, i) => (
              <motion.div key={r.id}
                initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: i*0.04 }}
                onClick={() => setSelected(r)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selected?.id === r.id
                    ? "border-secondary bg-light-blue"
                    : "border-gray-100 hover:border-blue-200"
                }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                    <p className="font-mono text-xs text-gray-400">{r.id}</p>
                  </div>
                  <div className="text-right">
                    <SeverityBadge severity={r.severity}/>
                    <p className="text-xs text-primary font-bold mt-1">{r.confidence}%</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Right: detail panel ────────────────────────────────────── */}
        {selected && (
          <motion.div className="xl:col-span-2 space-y-4"
            key={selected.id} initial={{ opacity:0 }} animate={{ opacity:1 }}>

            {/* Header */}
            <div className="card flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-gray-900 text-xl">{selected.name}</h2>
                <p className="text-gray-400 text-sm">{selected.id} · {selected.date} · {selected.eye}</p>
              </div>
              <SeverityBadge severity={selected.severity}/>
            </div>

            {/* Two-column: Retina viewer + AI Assessment */}
            <div className="grid grid-cols-2 gap-4">

              {/* Retina viewer — VADR DrDashboard feature */}
              <div className="card flex flex-col gap-3">
                <div>
                  <p className="font-display font-bold text-gray-900">Fundus Image</p>
                  <p className="text-xs text-gray-400">Synthetic anatomical rendering · {selected.eye}</p>
                </div>
                <div className="rounded-2xl overflow-hidden bg-black aspect-square relative retina-glow">
                  <RetinaSVG severity={selected.severity}/>
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-md">
                    OD · 45° · AI-rendered
                  </div>
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 rounded-md px-2 py-1">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: sevMeta?.color }}/>
                    <span className="text-[9px] text-white/80">Severity: {selected.severity}</span>
                  </div>
                </div>
              </div>

              {/* AI Assessment panel — VADR DrDashboard feature */}
              <div className="card flex flex-col gap-4">
                <div>
                  <p className="font-display font-bold text-gray-900">AI Assessment</p>
                  <p className="text-xs text-gray-400">RetinaNet v2.3 · {selected.processing_time || 1.2}s</p>
                </div>

                {/* Severity badge */}
                <div className="rounded-2xl p-4 text-center" style={{ background:sevMeta?.bg }}>
                  <div className="flex justify-center mb-2">
                    <SevIcon size={28} style={{ color:sevMeta?.color }}/>
                  </div>
                  <p className="font-display font-bold text-lg" style={{ color:sevMeta?.color }}>
                    {selected.severity}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{sevMeta?.label}</p>
                  <span className="inline-block mt-2 text-[11px] font-semibold px-3 py-1 rounded-full"
                    style={{ background:`${sevMeta?.color}22`, color:sevMeta?.color }}>
                    Risk: {sevMeta?.risk}
                  </span>
                </div>

                {/* Confidence arc gauge */}
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-2">Confidence Score</p>
                  <div className="relative inline-block">
                    <svg width="120" height="70" viewBox="0 0 120 70">
                      <path d="M10 64 A50 50 0 0 1 110 64" fill="none" stroke="#e5e7eb" strokeWidth="7" strokeLinecap="round"/>
                      <path d="M10 64 A50 50 0 0 1 110 64" fill="none" stroke={sevMeta?.color} strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${((selected.confidence||0)/100)*157} 157`}/>
                    </svg>
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xl font-display font-bold text-gray-900">
                      {selected.confidence}%
                    </div>
                  </div>
                </div>

                {/* Detected findings */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    Detected Findings
                  </p>
                  {findings.map(f => (
                    <div key={f.label} className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: f.present ? sevMeta?.color : "#e5e7eb" }}/>
                      <span className={`flex-1 text-xs ${f.present ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                        {f.label}
                      </span>
                      {f.present ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width:`${f.score*100}%`, background:sevMeta?.color }}/>
                          </div>
                          <span className="text-[10px] text-gray-400 w-6">{Math.round(f.score*100)}%</span>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Severity scale bar */}
            <div className="card">
              <p className="font-semibold text-gray-700 mb-3 text-sm">Severity Scale (ICDR)</p>
              <div className="flex gap-1">
                {SEV_LABELS.map((label, i) => (
                  <div key={label} className="flex-1 text-center">
                    <div className={`h-8 rounded-lg transition-all ${i === selected.severity_index ? "opacity-100 scale-105 shadow-md" : "opacity-25"}`}
                      style={{ background:SEV_COLORS[i] }}/>
                    <p className="text-[9px] text-gray-500 mt-1 leading-tight">{label.replace(" DR","")}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical info grid */}
            <div className="card grid grid-cols-3 gap-3">
              {[
                { label:"Affected Eye",      value: selected.eye           || "—" },
                { label:"Assessment Date",   value: selected.date          || "—" },
                { label:"HbA1c Level",       value: selected.hba1c ? `${selected.hba1c}%` : "—" },
                { label:"Blood Pressure",    value: selected.blood_pressure || "—" },
                { label:"Diabetic Duration", value: selected.diabetic_years ? `${selected.diabetic_years}y` : "—" },
                { label:"Gender / Age",      value: (selected.gender && selected.age) ? `${selected.gender}, ${selected.age}y` : "—" },
              ].map(row => (
                <div key={row.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{row.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{row.value}</p>
                </div>
              ))}
            </div>

            {/* Clinical recommendation */}
            <div className="card bg-light-blue border-blue-100">
              <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4"/> Clinical Recommendation
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{selected.recommendation}</p>
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}

const MOCK = [
  { id:"PAT-1000", name:"Ahmad Raza",    age:52, gender:"Male",   date:"2024-12-01", eye:"Left Eye",  severity:"No DR",            severity_index:0, confidence:96.2, diabetic_years:5,  hba1c:7.2, blood_pressure:"130/85",  recommendation:"No diabetic retinopathy detected. Continue annual screening." },
  { id:"PAT-1001", name:"Fatima Khan",   age:48, gender:"Female", date:"2024-12-03", eye:"Right Eye", severity:"Mild DR",          severity_index:1, confidence:88.7, diabetic_years:8,  hba1c:8.1, blood_pressure:"140/90",  recommendation:"Mild nonproliferative DR. Follow up in 12 months." },
  { id:"PAT-1002", name:"Muhammad Ali",  age:61, gender:"Male",   date:"2024-12-05", eye:"Left Eye",  severity:"Moderate DR",      severity_index:2, confidence:91.3, diabetic_years:12, hba1c:8.9, blood_pressure:"150/95",  recommendation:"Moderate DR. Ophthalmology referral in 3-6 months." },
  { id:"PAT-1003", name:"Ayesha Malik",  age:55, gender:"Female", date:"2024-12-07", eye:"Right Eye", severity:"Severe DR",        severity_index:3, confidence:85.9, diabetic_years:15, hba1c:9.5, blood_pressure:"158/100", recommendation:"Severe DR. Urgent ophthalmology referral required." },
  { id:"PAT-1004", name:"Usman Tariq",   age:43, gender:"Male",   date:"2024-12-09", eye:"Left Eye",  severity:"No DR",            severity_index:0, confidence:97.1, diabetic_years:3,  hba1c:6.8, blood_pressure:"120/80",  recommendation:"No DR detected. Annual monitoring recommended." },
  { id:"PAT-1005", name:"Zainab Hussain",age:67, gender:"Female", date:"2024-12-11", eye:"Right Eye", severity:"Proliferative DR", severity_index:4, confidence:93.4, diabetic_years:20, hba1c:10.2,blood_pressure:"165/105",recommendation:"Proliferative DR. Immediate surgical consultation required." },
];
