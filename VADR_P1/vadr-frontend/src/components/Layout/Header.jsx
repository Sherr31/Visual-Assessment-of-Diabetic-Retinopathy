


import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, AlertTriangle, AlertCircle,
  Info, CheckCircle2, X, Search, Users, ScanLine, ArrowRight, Loader2,
} from 'lucide-react';
import { fetchHistory } from '../../utils/api.js';

const SEVERITY = {
  'No DR':            { color: '#10B981' },
  'Mild DR':          { color: '#F59E0B' },
  'Moderate DR':      { color: '#F97316' },
  'Severe DR':        { color: '#EF4444' },
  'Proliferative DR': { color: '#7C3AED' },
};

const INIT_NOTIFS = [
  { id: 1, type: 'critical', icon: AlertTriangle, title: 'Proliferative DR Detected',  msg: 'Robert Chen (PT-0034) — NVD present. Immediate vitreoretinal referral required.',   time: '2 hours ago', read: false },
  { id: 2, type: 'high',     icon: AlertCircle,   title: 'Severe DR Progression',       msg: 'Nadia Khalil (PT-0062) — 4-quadrant haemorrhages. Anti-VEGF evaluation required.',  time: '5 hours ago', read: false },
  { id: 3, type: 'medium',   icon: AlertCircle,   title: 'HbA1c Target Missed',         msg: 'Amelia Hassan (PT-0021) — HbA1c 8.4%. Endocrinology referral advised.',              time: '1 day ago',   read: false },
  { id: 4, type: 'info',     icon: Info,          title: 'Follow-up Due in 7 Days',     msg: 'Thomas Wright (PT-0075) — Upcoming review appointment. Please confirm scheduling.', time: '2 days ago',  read: true  },
  { id: 5, type: 'success',  icon: CheckCircle2,  title: 'Scan Analysis Complete',      msg: 'David Okafor (PT-0058) — No DR detected. Annual review recommended.',              time: '3 days ago',  read: true  },
];
const NOTIF_STYLE = {
  critical: { dot: '#EF4444', bg: '#FEF2F2', iconColor: '#EF4444' },
  high:     { dot: '#F59E0B', bg: '#FFFBEB', iconColor: '#F59E0B' },
  medium:   { dot: '#F97316', bg: '#FFF7ED', iconColor: '#F97316' },
  info:     { dot: '#3A86FF', bg: '#EAF4FF', iconColor: '#3A86FF' },
  success:  { dot: '#10B981', bg: '#ECFDF5', iconColor: '#10B981' },
};

export function Header({ title, subtitle }) {
  const navigate = useNavigate();

  /* Clock */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Fetch data from API for search ── */
  const [apiPatients, setApiPatients] = useState([]);
  const [apiScans,    setApiScans]    = useState([]);
  const [apiLoading,  setApiLoading]  = useState(false);
  const [apiError,    setApiError]    = useState(false);
  const fetchedRef = useRef(false);

  const loadData = () => {
    fetchedRef.current = true;
    setApiLoading(true);
    fetchHistory()
      .then((scans) => {
        const arr = Array.isArray(scans) ? scans : [];
        setApiScans(arr);
        // derive unique patients from scan history
        const map = {};
        arr.forEach(s => {
          const pid = s.patientId || s.patient_id || s.id;
          if (pid && !map[pid]) {
            map[pid] = {
              id:        pid,
              name:      s.patientName || s.patient_name || s.name || 'Unknown',
              severity:  s.severity || '',
              type:      s.diabetesType || s.type || '',
              physician: s.doctor || s.physician || '',
            };
          }
        });
        setApiPatients(Object.values(map));
        setApiError(false);
      })
      .catch(() => setApiError(true))
      .finally(() => setApiLoading(false));
  };

  useEffect(() => { if (!fetchedRef.current) loadData(); }, []);

  /* ── Search state ── */
  const [query,      setQuery]      = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(-1);
  const searchRef = useRef(null);
  const inputRef  = useRef(null);

  function buildResults(q) {
    const ql = q.trim().toLowerCase();
    if (!ql) return { patients: [], scans: [] };
    return {
      patients: apiPatients.filter(p =>
        p.name?.toLowerCase().includes(ql) ||
        p.id?.toLowerCase().includes(ql) ||
        p.type?.toLowerCase().includes(ql) ||
        p.severity?.toLowerCase().includes(ql) ||
        p.physician?.toLowerCase().includes(ql)
      ).slice(0, 4),
      scans: apiScans.filter(s =>
        s.id?.toString().toLowerCase().includes(ql) ||
        (s.patientName || s.patient_name || '')?.toLowerCase().includes(ql) ||
        s.severity?.toLowerCase().includes(ql) ||
        s.doctor?.toLowerCase().includes(ql) ||
        s.date?.toLowerCase().includes(ql) ||
        s.eye?.toLowerCase().includes(ql)
      ).slice(0, 4),
    };
  }

  const results    = buildResults(query);
  const hasResults = results.patients.length > 0 || results.scans.length > 0;
  const allItems   = [
    ...results.patients.map(p => ({ kind: 'patient', data: p })),
    ...results.scans.map(s    => ({ kind: 'scan',    data: s })),
  ];

  useEffect(() => {
    if (!searchOpen) return;
    const fn = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchOpen(false); setActiveIdx(-1); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [searchOpen]);

  const handleKeyDown = (e) => {
    if (!searchOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Escape')    { setSearchOpen(false); setQuery(''); setActiveIdx(-1); inputRef.current?.blur(); }
    if (e.key === 'Enter' && activeIdx >= 0) handleSelect(allItems[activeIdx]);
  };

  const handleSelect = ({ kind }) => {
    setSearchOpen(false); setQuery(''); setActiveIdx(-1);
    navigate(kind === 'patient' ? '/patients' : '/assessment');
  };

  const clearSearch = () => { setQuery(''); setActiveIdx(-1); inputRef.current?.focus(); };

  /* ── Notifications ── */
  const [showNotif, setShowNotif] = useState(false);
  const [notifs,    setNotifs]    = useState(INIT_NOTIFS);
  const notifRef = useRef(null);
  const unread   = notifs.filter(n => !n.read).length;

  useEffect(() => {
    if (!showNotif) return;
    const fn = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [showNotif]);

  const markAllRead = (e) => { e.stopPropagation(); setNotifs(p => p.map(n => ({ ...n, read: true }))); };
  const markRead    = (id) => setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  const dismiss     = (e, id) => { e.stopPropagation(); setNotifs(p => p.filter(n => n.id !== id)); };

  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const SevPill = ({ severity }) => {
    const c = SEVERITY[severity]?.color || '#94A3B8';
    return <span style={{ background: `${c}18`, color: c, fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap' }}>{severity}</span>;
  };

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-100 flex items-center px-6 gap-4 sticky top-0 z-30">

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="font-display font-bold text-base text-slate-800 leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-[11px] text-muted hidden sm:block truncate">{subtitle}</p>}
      </div>

      {/* Live clock */}
      <div className="hidden lg:flex items-center gap-1.5 text-[11.5px] text-muted bg-bglight px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
        <span className="hidden xl:inline">{dateStr}</span>
        <span className="hidden xl:inline text-slate-300">·</span>
        <span className="font-mono font-medium text-slate-600">{timeStr}</span>
      </div>

      {/* SEARCH BAR */}
      <div className="relative hidden md:block" ref={searchRef}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: searchOpen ? '#fff' : '#F7FAFC', border: `1.5px solid ${searchOpen ? '#3A86FF' : '#E2E8F0'}`, borderRadius: '12px', padding: '7px 12px', transition: 'all 0.2s', width: searchOpen ? '300px' : '200px', boxShadow: searchOpen ? '0 0 0 3px rgba(58,134,255,0.12)' : 'none' }}>
          {apiLoading
            ? <Loader2 size={13} style={{ color: '#3A86FF', flexShrink: 0, animation: 'spin 1s linear infinite' }}/>
            : <Search size={13} style={{ color: searchOpen ? '#3A86FF' : '#94A3B8', flexShrink: 0, transition: 'color 0.2s' }}/>
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); setActiveIdx(-1); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={apiLoading ? 'Loading records…' : 'Search patients, scans…'}
            disabled={apiLoading}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '12.5px', color: '#1E293B', fontFamily: 'inherit', minWidth: 0 }}
          />
          {query && <button onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', display: 'flex', color: '#CBD5E1', lineHeight: 1 }}><X size={13}/></button>}
          {!query && !apiLoading && <kbd style={{ fontSize: '10px', color: '#CBD5E1', background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '1px 5px', borderRadius: '4px', fontFamily: 'inherit', flexShrink: 0 }}>⌘K</kbd>}
        </div>

        {searchOpen && !apiLoading && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '360px', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 16px 48px rgba(15,76,129,0.14)', zIndex: 9999, overflow: 'hidden' }}>

            {/* Error */}
            {apiError && (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <AlertCircle size={24} style={{ color: '#EF4444', display: 'block', margin: '0 auto 8px' }}/>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Could not connect to backend</p>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Make sure Flask is running on port 5000</p>
                <button onClick={() => { fetchedRef.current = false; setApiError(false); loadData(); }} style={{ marginTop: '10px', fontSize: '11px', padding: '5px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F7FAFC', color: '#3A86FF', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
              </div>
            )}

            {/* Empty query — quick access */}
            {!apiError && !query && (
              <div style={{ padding: '8px' }}>
                <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px 4px' }}>Quick Access</p>
                {[
                  { label: 'Patient Records',    icon: Users,    path: '/patients', sub: `${apiPatients.length} patients loaded` },
                  { label: 'Assessment Results', icon: ScanLine, path: '/assessment',  sub: `${apiScans.length} scans loaded`       },
                  { label: 'Upload New Scan',    icon: Search,   path: '/upload',   sub: 'AI-powered retinal analysis'            },
                ].map(({ label, icon: Icon, path, sub }) => (
                  <div key={path} onClick={() => { navigate(path); setSearchOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F7FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#EAF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={14} style={{ color: '#3A86FF' }}/></div>
                    <div style={{ flex: 1 }}><p style={{ fontSize: '12.5px', fontWeight: 500, color: '#1E293B' }}>{label}</p><p style={{ fontSize: '10px', color: '#94A3B8' }}>{sub}</p></div>
                    <ArrowRight size={12} style={{ color: '#CBD5E1' }}/>
                  </div>
                ))}

                {apiPatients.length > 0 && <>
                  <div style={{ borderTop: '1px solid #F1F5F9', margin: '6px 0' }}/>
                  <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px 4px' }}>Recent Patients</p>
                  {apiPatients.slice(0, 3).map(p => {
                    const c = SEVERITY[p.severity]?.color || '#94A3B8';
                    return (
                      <div key={p.id} onClick={() => { navigate('/patients'); setSearchOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F7FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: `linear-gradient(135deg, ${c}, ${c}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{p.name?.split(' ').map(n => n[0]).join('')}</div>
                        <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: '12px', fontWeight: 500, color: '#1E293B' }}>{p.name}</p><p style={{ fontSize: '10px', color: '#94A3B8' }}>{p.id} · {p.type}</p></div>
                        <SevPill severity={p.severity}/>
                      </div>
                    );
                  })}
                </>}
              </div>
            )}

            {/* Has query — results */}
            {!apiError && query && hasResults && (
              <div style={{ padding: '8px' }}>
                {results.patients.length > 0 && <>
                  <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px 4px' }}>Patients · {results.patients.length} found</p>
                  {results.patients.map((p, i) => {
                    const c = SEVERITY[p.severity]?.color || '#94A3B8';
                    const isActive = activeIdx === i;
                    return (
                      <div key={p.id} onClick={() => handleSelect({ kind: 'patient', data: p })}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', background: isActive ? '#EAF4FF' : 'transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F7FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = isActive ? '#EAF4FF' : 'transparent'}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `linear-gradient(135deg, ${c}, ${c}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>{p.name?.split(' ').map(n => n[0]).join('')}</div>
                        <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: '12.5px', fontWeight: 600, color: '#1E293B' }}>{highlightMatch(p.name, query)}</p><p style={{ fontSize: '10px', color: '#94A3B8' }}>{p.id} · {p.type} · {p.physician}</p></div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}><SevPill severity={p.severity}/><span style={{ fontSize: '9.5px', color: '#CBD5E1' }}>Patient</span></div>
                      </div>
                    );
                  })}
                </>}

                {results.scans.length > 0 && <>
                  {results.patients.length > 0 && <div style={{ borderTop: '1px solid #F1F5F9', margin: '6px 0' }}/>}
                  <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px 4px' }}>Scans · {results.scans.length} found</p>
                  {results.scans.map((s, i) => {
                    const c = SEVERITY[s.severity]?.color || '#94A3B8';
                    const isActive = activeIdx === results.patients.length + i;
                    return (
                      <div key={s.id} onClick={() => handleSelect({ kind: 'scan', data: s })}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', background: isActive ? '#EAF4FF' : 'transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F7FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = isActive ? '#EAF4FF' : 'transparent'}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ScanLine size={14} style={{ color: c }}/></div>
                        <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', fontFamily: 'monospace' }}>{s.id}</p><p style={{ fontSize: '10px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.patientName || s.patient_name} · {s.date} · {s.eye} · {s.doctor}</p></div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}><SevPill severity={s.severity}/><span style={{ fontSize: '9.5px', color: '#CBD5E1' }}>{s.conf?.toFixed(1)}%</span></div>
                      </div>
                    );
                  })}
                </>}
              </div>
            )}

            {/* No results */}
            {!apiError && query && !hasResults && (
              <div style={{ padding: '36px 24px', textAlign: 'center' }}>
                <Search size={28} style={{ color: '#CBD5E1', display: 'block', margin: '0 auto 10px' }}/>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>No results for "{query}"</p>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Try patient name, scan ID, severity or physician</p>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '14px' }}>
                  {['No DR', 'Mild DR', 'Severe DR'].map(s => <button key={s} onClick={() => setQuery(s)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F7FAFC', color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>)}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid #F1F5F9', background: '#F7FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#CBD5E1' }}>{apiError ? 'Backend offline' : query ? `${allItems.length} result${allItems.length !== 1 ? 's' : ''}` : `${apiPatients.length} patients · ${apiScans.length} scans`}</span>
              <span style={{ fontSize: '10px', color: '#CBD5E1' }}>↑↓ · Enter · Esc</span>
            </div>
          </div>
        )}
      </div>

      {/* NOTIFICATIONS */}
      <div className="relative" ref={notifRef}>
        <button onClick={() => setShowNotif(v => !v)}
          style={{ position: 'relative', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', border: '1.5px solid #E2E8F0', background: showNotif ? '#EAF4FF' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!showNotif) e.currentTarget.style.background = '#F7FAFC'; }}
          onMouseLeave={e => { if (!showNotif) e.currentTarget.style.background = '#fff'; }}>
          <Bell size={15} style={{ color: showNotif ? '#0F4C81' : '#94A3B8' }}/>
          {unread > 0 && <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', borderRadius: '99px', background: '#EF4444', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', padding: '0 3px' }}>{unread}</span>}
        </button>

        {showNotif && (
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: '370px', background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.13)', zIndex: 9999, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>Notifications</span>
                {unread > 0 && <span style={{ background: '#EF4444', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '99px' }}>{unread} new</span>}
              </div>
              {unread > 0 && <button onClick={markAllRead} style={{ fontSize: '12px', color: '#3A86FF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Mark all read</button>}
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {notifs.length === 0
                ? <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}><CheckCircle2 size={28} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }}/><p style={{ fontSize: '13px' }}>All caught up!</p></div>
                : notifs.map(n => {
                    const s = NOTIF_STYLE[n.type]; const Icon = n.icon;
                    return (
                      <div key={n.id} onClick={() => markRead(n.id)}
                        style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #F8FAFC', cursor: 'pointer', background: n.read ? '#fff' : '#FAFBFF', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F7FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#FAFBFF'}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} style={{ color: s.iconColor }}/></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <p style={{ fontSize: '12px', fontWeight: n.read ? 500 : 700, color: n.read ? '#64748B' : '#1E293B', lineHeight: 1.3 }}>
                              {n.title}{!n.read && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: s.dot, marginLeft: '6px', verticalAlign: 'middle' }}/>}
                            </p>
                            <button onClick={e => dismiss(e, n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '1px', flexShrink: 0, lineHeight: 1 }}><X size={11}/></button>
                          </div>
                          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', lineHeight: 1.5 }}>{n.msg}</p>
                          <p style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '4px' }}>{n.time}</p>
                        </div>
                      </div>
                    );
                  })}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9', background: '#F7FAFC', textAlign: 'center' }}>
              <button style={{ fontSize: '12px', color: '#3A86FF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>View all notifications →</button>
            </div>
          </div>
        )}
      </div>

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #0F4C81, #3A86FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>DR</div>
        <div className="hidden sm:block">
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', lineHeight: 1 }}>Dr. Rana Ahmed</div>
          <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Ophthalmologist</div>
        </div>
        <ChevronDown size={12} style={{ color: '#94A3B8' }}/>
      </div>

    </header>
  );
}

function highlightMatch(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '2px', padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}