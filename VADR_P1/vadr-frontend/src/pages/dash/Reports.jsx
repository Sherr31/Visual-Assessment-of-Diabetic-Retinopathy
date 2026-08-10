// import React, { useEffect, useState } from "react";
// import { motion } from "framer-motion";
// import { Download, Printer, FileText, Eye } from "lucide-react";
// import SeverityBadge from "../../components/Dashboard/SeverityBadge";
// import { fetchHistory } from "../../utils/api";

// export default function Reports() {
//   const [patients, setPatients] = useState([]);
//   const [selected, setSelected] = useState(null);

//   useEffect(() => {
//     fetchHistory().then(d => { setPatients(d.records); setSelected(d.records[0]); })
//       .catch(() => { setPatients(MOCK); setSelected(MOCK[0]); });
//   }, []);

//   return (
//     <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
//       {/* Patient selector */}
//       <div className="card max-h-[640px] overflow-y-auto">
//         <h2 className="font-display font-bold text-gray-900 mb-4">Select Patient</h2>
//         <div className="space-y-2">
//           {patients.map(p => (
//             <div key={p.id} onClick={() => setSelected(p)}
//               className={`p-3 rounded-xl border cursor-pointer transition-all ${
//                 selected?.id === p.id ? "border-secondary bg-light-blue" : "border-gray-100 hover:border-blue-200"
//               }`}
//             >
//               <p className="text-sm font-semibold text-gray-800">{p.name}</p>
//               <div className="flex items-center justify-between mt-1">
//                 <span className="font-mono text-xs text-gray-400">{p.id}</span>
//                 <SeverityBadge severity={p.severity} />
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* Report Preview */}
//       <div className="xl:col-span-2">
//         {selected && (
//           <motion.div className="card" key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
//             {/* Actions */}
//             <div className="flex items-center justify-between mb-6">
//               <div className="flex items-center gap-2">
//                 <FileText className="w-5 h-5 text-primary" />
//                 <h2 className="font-display font-bold text-gray-900">Medical Report</h2>
//               </div>
//               <div className="flex gap-2">
//                 <button className="btn-secondary text-sm py-2 px-4">
//                   <Printer className="w-4 h-4" /> Print
//                 </button>
//                 <button className="btn-primary text-sm py-2 px-4">
//                   <Download className="w-4 h-4" /> Export PDF
//                 </button>
//               </div>
//             </div>

//             {/* Report content */}
//             <div className="border border-gray-200 rounded-2xl overflow-hidden">
//               {/* Header */}
//               <div className="p-6" style={{ background: "linear-gradient(135deg, #0F4C81, #3A86FF)" }}>
//                 <div className="flex justify-between items-start text-white">
//                   <div>
//                     <div className="flex items-center gap-2 mb-2">
//                       <Eye className="w-5 h-5 opacity-80" />
//                       <span className="font-display font-bold text-lg">VADR</span>
//                     </div>
//                     <p className="text-blue-200 text-sm">Diabetic Retinopathy Assessment Report</p>
//                   </div>
//                   <div className="text-right">
//                     <p className="text-sm font-mono text-blue-200">{selected.id}</p>
//                     <p className="text-sm text-blue-200">{selected.date}</p>
//                   </div>
//                 </div>
//               </div>

//               <div className="p-6 space-y-5">
//                 {/* Patient Info */}
//                 <div>
//                   <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Patient Information</h3>
//                   <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
//                     {[
//                       ["Patient Name", selected.name],
//                       ["Patient ID",   selected.id],
//                       ["Age",          `${selected.age} years`],
//                       ["Gender",       selected.gender],
//                       ["Affected Eye", selected.eye],
//                       ["Assessment Date", selected.date],
//                     ].map(([label, value]) => (
//                       <div key={label} className="bg-gray-50 rounded-xl p-3">
//                         <p className="text-xs text-gray-400">{label}</p>
//                         <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
//                       </div>
//                     ))}
//                   </div>
//                 </div>

//                 <div className="border-t border-gray-100" />

//                 {/* Clinical Data */}
//                 <div>
//                   <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Clinical Data</h3>
//                   <div className="grid grid-cols-3 gap-3">
//                     {[
//                       ["Diabetic Duration", `${selected.diabetic_years} years`],
//                       ["HbA1c",             `${selected.hba1c}%`],
//                       ["Blood Pressure",    selected.blood_pressure],
//                     ].map(([label, value]) => (
//                       <div key={label} className="bg-gray-50 rounded-xl p-3">
//                         <p className="text-xs text-gray-400">{label}</p>
//                         <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
//                       </div>
//                     ))}
//                   </div>
//                 </div>

//                 <div className="border-t border-gray-100" />

//                 {/* Diagnosis */}
//                 <div>
//                   <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">AI Diagnosis</h3>
//                   <div className="grid grid-cols-3 gap-3 mb-4">
//                     <div className="bg-light-blue rounded-xl p-4 text-center">
//                       <p className="text-xs text-gray-500 mb-1">Classification</p>
//                       <SeverityBadge severity={selected.severity} />
//                     </div>
//                     <div className="bg-gray-50 rounded-xl p-4 text-center">
//                       <p className="text-xs text-gray-500 mb-1">Confidence</p>
//                       <p className="font-display text-xl font-bold text-primary">{selected.confidence}%</p>
//                     </div>
//                     <div className="bg-gray-50 rounded-xl p-4 text-center">
//                       <p className="text-xs text-gray-500 mb-1">Severity Grade</p>
//                       <p className="font-display text-xl font-bold text-gray-800">Grade {selected.severity_index}</p>
//                     </div>
//                   </div>

//                   {/* Progress */}
//                   <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
//                     <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 via-orange-500 to-red-500 rounded-full"
//                       style={{ width: "100%" }} />
//                   </div>
//                   <div className="relative">
//                     <div className="absolute h-4 w-0.5 bg-gray-800 rounded-full"
//                       style={{ left: `${selected.severity_index * 25}%` }} />
//                   </div>
//                 </div>

//                 <div className="border-t border-gray-100" />

//                 {/* Recommendation */}
//                 <div>
//                   <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Clinical Recommendation</h3>
//                   <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
//                     <p className="text-sm text-gray-700 leading-relaxed">{selected.recommendation}</p>
//                   </div>
//                 </div>

//                 {/* Footer */}
//                 <div className="border-t border-gray-100 pt-4">
//                   <p className="text-xs text-gray-400 text-center">
//                     This report was generated by RetinaAI (RetinaNet-v2.3). For clinical use only under qualified ophthalmologist supervision.
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </div>
//     </div>
//   );
// }

// const MOCK = [
//   { id:"PAT-1000", name:"Ahmad Raza",    age:52, gender:"Male",   date:"2024-12-01", severity:"No DR",            severity_index:0, confidence:96.2, eye:"Left Eye",  diabetic_years:5,  hba1c:7.2, blood_pressure:"130/85", recommendation:"No diabetic retinopathy detected. Continue annual screening." },
//   { id:"PAT-1001", name:"Fatima Khan",   age:48, gender:"Female", date:"2024-12-03", severity:"Mild DR",          severity_index:1, confidence:88.7, eye:"Right Eye", diabetic_years:8,  hba1c:8.1, blood_pressure:"140/90", recommendation:"Mild nonproliferative DR. Follow up in 12 months." },
//   { id:"PAT-1002", name:"Muhammad Ali",  age:61, gender:"Male",   date:"2024-12-05", severity:"Moderate DR",      severity_index:2, confidence:91.3, eye:"Left Eye",  diabetic_years:12, hba1c:8.9, blood_pressure:"150/95", recommendation:"Moderate DR. Ophthalmology referral in 3-6 months." },
// ];




import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Printer, FileText, Eye, CheckCircle2, X } from "lucide-react";
import SeverityBadge from "../../components/Dashboard/SeverityBadge";
import { fetchHistory } from "../../utils/api";

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: { bg: '#ECFDF5', border: '#6EE7B7', icon: '#10B981', text: '#065F46' },
    info:    { bg: '#EFF6FF', border: '#93C5FD', icon: '#3B82F6', text: '#1E40AF' },
    error:   { bg: '#FEF2F2', border: '#FCA5A5', icon: '#EF4444', text: '#991B1B' },
  };
  const c = colors[type] || colors.success;

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999,
      display: 'flex', alignItems: 'center', gap: '10px',
      background: c.bg, border: `1.5px solid ${c.border}`,
      borderRadius: '12px', padding: '12px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      animation: 'slideUp 0.3s ease both',
      minWidth: '280px', maxWidth: '360px',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <CheckCircle2 size={18} style={{ color: c.icon, flexShrink: 0 }} />
      <p style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: c.text }}>{message}</p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.icon, padding: '1px', lineHeight: 1 }}>
        <X size={14} />
      </button>
    </div>
  );
}

function buildReportHTML(patient) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>VADR Report — ${patient.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1E293B; padding: 40px; }
        .header { background: linear-gradient(135deg, #0F4C81, #3A86FF); color: #fff; padding: 28px 32px; border-radius: 12px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-start; }
        .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .subtitle { color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 4px; }
        .meta { text-align: right; font-size: 12px; color: rgba(255,255,255,0.7); font-family: monospace; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .cell { background: #F8FAFC; border-radius: 10px; padding: 12px 14px; }
        .cell label { font-size: 10px; color: #94A3B8; display: block; margin-bottom: 3px; }
        .cell value { font-size: 13px; font-weight: 600; color: #1E293B; }
        .divider { border: none; border-top: 1px solid #F1F5F9; margin: 20px 0; }
        .recommendation { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 16px; font-size: 13px; line-height: 1.6; color: #1E40AF; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #F1F5F9; text-align: center; font-size: 11px; color: #94A3B8; }
        .confidence-bar { height: 10px; background: #F1F5F9; border-radius: 99px; overflow: hidden; margin-top: 8px; }
        .confidence-fill { height: 100%; background: linear-gradient(90deg, #10B981, #3A86FF); border-radius: 99px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">👁 VADR</div>
          <div class="subtitle">Diabetic Retinopathy Assessment Report</div>
        </div>
        <div class="meta">
          <div>${patient.id}</div>
          <div style="margin-top:4px">${patient.date}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Patient Information</div>
        <div class="grid">
          <div class="cell"><label>Patient Name</label><value>${patient.name}</value></div>
          <div class="cell"><label>Patient ID</label><value>${patient.id}</value></div>
          <div class="cell"><label>Age</label><value>${patient.age} years</value></div>
          <div class="cell"><label>Gender</label><value>${patient.gender}</value></div>
          <div class="cell"><label>Affected Eye</label><value>${patient.eye}</value></div>
          <div class="cell"><label>Assessment Date</label><value>${patient.date}</value></div>
        </div>
      </div>

      <hr class="divider"/>

      <div class="section">
        <div class="section-title">Clinical Data</div>
        <div class="grid">
          <div class="cell"><label>Diabetic Duration</label><value>${patient.diabetic_years} years</value></div>
          <div class="cell"><label>HbA1c</label><value>${patient.hba1c}%</value></div>
          <div class="cell"><label>Blood Pressure</label><value>${patient.blood_pressure}</value></div>
        </div>
      </div>

      <hr class="divider"/>

      <div class="section">
        <div class="section-title">AI Diagnosis</div>
        <div class="grid">
          <div class="cell"><label>Classification</label><value>${patient.severity}</value></div>
          <div class="cell"><label>Confidence Score</label><value>${patient.confidence}%
            <div class="confidence-bar"><div class="confidence-fill" style="width:${patient.confidence}%"></div></div>
          </value></div>
          <div class="cell"><label>Severity Grade</label><value>Grade ${patient.severity_index}</value></div>
        </div>
      </div>

      <hr class="divider"/>

      <div class="section">
        <div class="section-title">Clinical Recommendation</div>
        <div class="recommendation">${patient.recommendation}</div>
      </div>

      <div class="footer">
        This report was generated by RetinaAI (RetinaNet-v2.3). For clinical use only under qualified ophthalmologist supervision.<br/>
        Generated on ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </body>
    </html>
  `;
}

export default function Reports() {
  const [patients,     setPatients]     = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [toast,        setToast]        = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchHistory()
      .then(d => { setPatients(d.records); setSelected(d.records[0]); })
      .catch(() => { setPatients(MOCK); setSelected(MOCK[0]); });
  }, []);

  const handlePrint = () => {
    if (!selected) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(buildReportHTML(selected));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
    setToast({ message: `Print dialog opened for ${selected.name}`, type: 'info' });
  };

  const handleExportPDF = () => {
    if (!selected) return;
    setIsGenerating(true);
    const blob = new Blob([buildReportHTML(selected)], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank', 'width=900,height=700');
    win.focus();
    setTimeout(() => {
      win.print();
      URL.revokeObjectURL(url);
      setIsGenerating(false);
      setToast({ message: `Report for ${selected.name} ready — choose "Save as PDF" in the print dialog`, type: 'success' });
    }, 600);
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Patient selector */}
        <div className="card max-h-[640px] overflow-y-auto">
          <h2 className="font-display font-bold text-gray-900 mb-4">Select Patient</h2>
          <div className="space-y-2">
            {patients.map(p => (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selected?.id === p.id ? "border-secondary bg-light-blue" : "border-gray-100 hover:border-blue-200"
                }`}
              >
                <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-xs text-gray-400">{p.id}</span>
                  <SeverityBadge severity={p.severity} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Preview */}
        <div className="xl:col-span-2">
          {selected && (
            <motion.div className="card" key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-bold text-gray-900">Medical Report</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="btn-secondary text-sm py-2 px-4"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={isGenerating}
                    className="btn-primary text-sm py-2 px-4"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isGenerating ? 'wait' : 'pointer', opacity: isGenerating ? 0.75 : 1, transition: 'opacity 0.2s' }}
                  >
                    <Download className="w-4 h-4" />
                    {isGenerating ? 'Generating…' : 'Export PDF'}
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="p-6" style={{ background: "linear-gradient(135deg, #0F4C81, #3A86FF)" }}>
                  <div className="flex justify-between items-start text-white">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-5 h-5 opacity-80" />
                        <span className="font-display font-bold text-lg">VADR</span>
                      </div>
                      <p className="text-blue-200 text-sm">Diabetic Retinopathy Assessment Report</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-blue-200">{selected.id}</p>
                      <p className="text-sm text-blue-200">{selected.date}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Patient Information</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        ["Patient Name", selected.name],
                        ["Patient ID",   selected.id],
                        ["Age",          `${selected.age} years`],
                        ["Gender",       selected.gender],
                        ["Affected Eye", selected.eye],
                        ["Assessment Date", selected.date],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Clinical Data</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["Diabetic Duration", `${selected.diabetic_years} years`],
                        ["HbA1c",             `${selected.hba1c}%`],
                        ["Blood Pressure",    selected.blood_pressure],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">AI Diagnosis</h3>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-light-blue rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Classification</p>
                        <SeverityBadge severity={selected.severity} />
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Confidence</p>
                        <p className="font-display text-xl font-bold text-primary">{selected.confidence}%</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Severity Grade</p>
                        <p className="font-display text-xl font-bold text-gray-800">Grade {selected.severity_index}</p>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
                      <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 via-orange-500 to-red-500 rounded-full" style={{ width: "100%" }} />
                    </div>
                    <div className="relative">
                      <div className="absolute h-4 w-0.5 bg-gray-800 rounded-full" style={{ left: `${selected.severity_index * 25}%` }} />
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Clinical Recommendation</h3>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-sm text-gray-700 leading-relaxed">{selected.recommendation}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 text-center">
                      This report was generated by RetinaAI (RetinaNet-v2.3). For clinical use only under qualified ophthalmologist supervision.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
}

const MOCK = [
  { id: "PAT-1000", name: "Ahmad Raza",   age: 52, gender: "Male",   date: "2024-12-01", severity: "No DR",       severity_index: 0, confidence: 96.2, eye: "Left Eye",  diabetic_years: 5,  hba1c: 7.2, blood_pressure: "130/85", recommendation: "No diabetic retinopathy detected. Continue annual screening." },
  { id: "PAT-1001", name: "Fatima Khan",  age: 48, gender: "Female", date: "2024-12-03", severity: "Mild DR",     severity_index: 1, confidence: 88.7, eye: "Right Eye", diabetic_years: 8,  hba1c: 8.1, blood_pressure: "140/90", recommendation: "Mild nonproliferative DR. Follow up in 12 months." },
  { id: "PAT-1002", name: "Muhammad Ali", age: 61, gender: "Male",   date: "2024-12-05", severity: "Moderate DR", severity_index: 2, confidence: 91.3, eye: "Left Eye",  diabetic_years: 12, hba1c: 8.9, blood_pressure: "150/95", recommendation: "Moderate DR. Ophthalmology referral in 3-6 months." },
];