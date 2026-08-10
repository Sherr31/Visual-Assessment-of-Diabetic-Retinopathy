import React, { useState } from "react";
import { motion } from "framer-motion";
import { Save, Bell, Shield, Cpu, User, Palette } from "lucide-react";

export default function Settings() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile */}
      <Section icon={User} title="User Profile" delay={0}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name" defaultValue="Dr. Rahman" />
          <Field label="Specialization" defaultValue="Ophthalmologist" />
          <Field label="Email" defaultValue="dr.rahman@hospital.pk" type="email" />
          <Field label="Hospital" defaultValue="PIMS Islamabad" />
        </div>
      </Section>

      {/* Model Settings */}
      <Section icon={Cpu} title="AI Model Settings" delay={0.1}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Active Model</label>
            <select className="input-field">
              <option>RetinaNet-v2.3 (Current)</option>
              <option>ResNet-50 v1.8</option>
              <option>EfficientNet-B4</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Confidence Threshold</label>
            <input type="range" min="70" max="99" defaultValue="80" className="w-full accent-secondary" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>70%</span><span>80% (default)</span><span>99%</span>
            </div>
          </div>
          <Toggle label="Enable Grad-CAM Visualization" defaultChecked />
          <Toggle label="Auto-process on upload" />
        </div>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notifications" delay={0.2}>
        <div className="space-y-3">
          <Toggle label="High-risk case alerts" defaultChecked />
          <Toggle label="Daily summary report" defaultChecked />
          <Toggle label="System health alerts" />
          <Toggle label="Email notifications" defaultChecked />
        </div>
      </Section>

      {/* Security */}
      <Section icon={Shield} title="Security" delay={0.3}>
        <div className="space-y-4">
          <Field label="Current Password" type="password" placeholder="••••••••" />
          <Field label="New Password" type="password" placeholder="••••••••" />
          <Toggle label="Two-factor authentication" />
          <Toggle label="Session timeout (30 min)" defaultChecked />
        </div>
      </Section>

      <div className="flex justify-end gap-3">
        <button className="btn-secondary">Discard Changes</button>
        <button className="btn-primary" onClick={handleSave}>
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, delay }) {
  return (
    <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
        <div className="w-9 h-9 bg-light-blue rounded-xl flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-display font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

function Field({ label, defaultValue, type = "text", placeholder }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1.5">{label}</label>
      <input type={type} defaultValue={defaultValue} placeholder={placeholder} className="input-field" />
    </div>
  );
}

function Toggle({ label, defaultChecked = false }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button onClick={() => setOn(v => !v)}
        className={`w-11 h-6 rounded-full transition-all duration-300 relative ${on ? "bg-secondary" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${on ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}
