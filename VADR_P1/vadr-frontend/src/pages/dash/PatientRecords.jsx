import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, User, Calendar, Eye, Activity } from "lucide-react";
import SeverityBadge from "../../components/Dashboard/SeverityBadge";
import { fetchHistory } from "../../utils/api";

export default function PatientRecords() {
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory()
      .then(d => setPatients(d.records))
      .catch(() => setPatients(MOCK))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    (severityFilter === "All" || p.severity === severityFilter) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) || p.id.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* List */}
      <div className="xl:col-span-2 card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-gray-900 text-lg">Patient Records</h2>
          <span className="badge bg-light-blue text-primary border border-blue-200">{filtered.length} patients</span>
        </div>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-9 text-sm" placeholder="Search by name or ID..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <select className="input-field w-40 text-sm" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
            {["All","No DR","Mild DR","Moderate DR","Severe DR","Proliferative DR"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array(6).fill(0).map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelected(p)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  selected?.id === p.id
                    ? "border-secondary bg-light-blue"
                    : "border-gray-100 hover:border-blue-200 hover:bg-blue-50/50"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {p.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                    <SeverityBadge severity={p.severity} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-xs text-gray-400">{p.id}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-400">{p.date}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs font-semibold text-primary">{p.confidence}%</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {!filtered.length && (
              <div className="text-center py-12 text-gray-400">
                <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No patients found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail */}
      <div>
        {selected ? (
          <motion.div className="card space-y-5" key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
                {selected.name.charAt(0)}
              </div>
              <h3 className="font-display font-bold text-gray-900 text-lg">{selected.name}</h3>
              <p className="text-gray-400 text-sm">{selected.id}</p>
              <div className="mt-2"><SeverityBadge severity={selected.severity} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: User,     label: "Age",      value: `${selected.age} years` },
                { icon: User,     label: "Gender",   value: selected.gender },
                { icon: Calendar, label: "Date",     value: selected.date },
                { icon: Eye,      label: "Eye",      value: selected.eye },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Clinical Data
              </h4>
              {[
                { label: "Diabetic Duration", value: `${selected.diabetic_years} years` },
                { label: "HbA1c",             value: `${selected.hba1c}%` },
                { label: "Blood Pressure",    value: selected.blood_pressure },
                { label: "Confidence Score",  value: `${selected.confidence}%` },
              ].map(row => (
                <div key={row.label} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs font-semibold text-primary mb-1.5">Clinical Recommendation</p>
              <p className="text-xs text-gray-600 leading-relaxed">{selected.recommendation}</p>
            </div>
          </motion.div>
        ) : (
          <div className="card h-full flex flex-col items-center justify-center text-center min-h-[300px]">
            <User className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">Select a patient to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

const MOCK = [
  { id:"PAT-1000", name:"Ahmad Raza",    age:52, gender:"Male",   date:"2024-12-01", severity:"No DR",            severity_index:0, confidence:96.2, eye:"Left Eye",  diabetic_years:5,  hba1c:7.2, blood_pressure:"130/85", recommendation:"No diabetic retinopathy detected. Continue annual screening." },
  { id:"PAT-1001", name:"Fatima Khan",   age:48, gender:"Female", date:"2024-12-03", severity:"Mild DR",          severity_index:1, confidence:88.7, eye:"Right Eye", diabetic_years:8,  hba1c:8.1, blood_pressure:"140/90", recommendation:"Mild nonproliferative DR. Follow up in 12 months." },
  { id:"PAT-1002", name:"Muhammad Ali",  age:61, gender:"Male",   date:"2024-12-05", severity:"Moderate DR",      severity_index:2, confidence:91.3, eye:"Left Eye",  diabetic_years:12, hba1c:8.9, blood_pressure:"150/95", recommendation:"Moderate DR. Ophthalmology referral in 3-6 months." },
  { id:"PAT-1003", name:"Ayesha Malik",  age:55, gender:"Female", date:"2024-12-07", severity:"Severe DR",        severity_index:3, confidence:85.9, eye:"Right Eye", diabetic_years:15, hba1c:9.5, blood_pressure:"158/100", recommendation:"Severe DR. Urgent ophthalmology referral required." },
  { id:"PAT-1004", name:"Usman Tariq",   age:43, gender:"Male",   date:"2024-12-09", severity:"No DR",            severity_index:0, confidence:97.1, eye:"Left Eye",  diabetic_years:3,  hba1c:6.8, blood_pressure:"120/80", recommendation:"No DR detected. Annual monitoring recommended." },
  { id:"PAT-1005", name:"Zainab Hussain",age:67, gender:"Female", date:"2024-12-11", severity:"Proliferative DR", severity_index:4, confidence:93.4, eye:"Right Eye", diabetic_years:20, hba1c:10.2, blood_pressure:"165/105", recommendation:"Proliferative DR. Immediate surgical consultation required." },
];
