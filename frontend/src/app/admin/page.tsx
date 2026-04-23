"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { authFetch, TokenStore } from "@/utils/auth";
import { useTheme, Icon } from "@/components/shared";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type UserAnalytics = {
  user_id: number; username: string; full_name: string; is_active: boolean;
  last_login: string | null; sessions_count: number; total_min: number;
  level: number; target_cefr: string;
  ma: { range:number; accuracy:number; fluency:number; coherence:number; phonology:number; overall:number };
  score_trend: { session:number; overall:number; range:number; accuracy:number; fluency:number; coherence:number; phonology:number; date:string; scenario:string }[];
};
type Scenario = { id:number; title:string; description:string|null };
type User     = { id:number; username:string; email:string; full_name:string|null; role:string; is_active:boolean; created_at:string; last_login_at:string|null };
type Tab      = "analytics" | "users" | "scenarios";
type Dim      = "overall"|"range"|"accuracy"|"fluency"|"coherence"|"phonology";

// ─── Constants ────────────────────────────────────────────────────────────────
const USER_COLORS = ["#00c896","#818cf8","#f472b6","#fbbf24","#60a5fa","#34d399","#f87171","#a78bfa","#fb923c","#38bdf8"];
const DIM_OPTS: { key: Dim; label: string }[] = [
  { key:"overall",   label:"Overall" },
  { key:"range",     label:"Kosakata" },
  { key:"accuracy",  label:"Tata Bahasa" },
  { key:"fluency",   label:"Kelancaran" },
  { key:"coherence", label:"Koherensi" },
  { key:"phonology", label:"Pelafalan" },
];
const DIM_ID: Record<string,string> = {
  range:"Kosakata", accuracy:"Tata Bahasa", fluency:"Kelancaran", coherence:"Koherensi", phonology:"Pelafalan",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cefrKey(s:number){ if(s>=4.5)return"C1+"; if(s>=3.5)return"B2"; if(s>=2.5)return"B1"; if(s>=1.5)return"A2"; return"A1"; }
function toP(s:number){ return Math.max(0,Math.min(100,((s-1)/4)*100)); }
function scoreCol(s:number){ return s>=3.5?"var(--accent)":s>=2.5?"var(--warn)":"var(--danger)"; }

// Build multi-user line chart data
function buildMultiData(users: UserAnalytics[], dim: Dim) {
  const maxSessions = Math.max(...users.map(u=>u.score_trend.length), 0);
  if (!maxSessions) return [];
  return Array.from({ length: maxSessions }, (_, i) => {
    const pt: Record<string,any> = { session: i+1 };
    users.forEach(u => { pt[u.username] = u.score_trend[i]?.[dim] ?? null; });
    return pt;
  });
}

// Custom tooltip for multi-line chart
function MultiTooltip({ active, payload, label }:any) {
  if (!active||!payload?.length) return null;
  return (
    <div className="rounded-2xl border px-4 py-3 text-xs shadow-lg"
      style={{ background:"var(--surface)", borderColor:"var(--border2)", minWidth:160 }}>
      <p className="font-semibold mb-2" style={{ color:"var(--text2)" }}>Sesi ke-{label}</p>
      {payload.map((p:any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background:p.color }} />
            <span style={{ color:"var(--text2)" }}>{p.name}</span>
          </div>
          <span className="font-bold" style={{ color:p.color }}>
            {typeof p.value==="number"?p.value.toFixed(2):"—"}/5
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const API = (process.env.NEXT_PUBLIC_API_BASE_URL||"http://localhost:8000").replace(/\/+$/,"");
  const { dark, toggle } = useTheme();

  const [tab,        setTab]        = useState<Tab>("analytics");
  const [analytics,  setAnalytics]  = useState<UserAnalytics[]>([]);
  const [users,      setUsers]      = useState<User[]>([]);
  const [scenarios,  setScenarios]  = useState<Scenario[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState<string|null>(null);
  const [success,    setSuccess]    = useState<string|null>(null);
  const [selected,   setSelected]   = useState<UserAnalytics|null>(null);
  const [activeDim,  setActiveDim]  = useState<Dim>("overall");
  const [newTitle,   setNewTitle]   = useState("");
  const [newDesc,    setNewDesc]    = useState("");
  const [saving,     setSaving]     = useState(false);
  const [username,   setUsername]   = useState("");
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!TokenStore.isLoggedIn()) { window.location.href="/auth"; return; }
    if (TokenStore.getRole()!=="admin") { window.location.href="/practice"; return; }
    setUsername(TokenStore.getUsername()||"admin");
  }, []);

  useEffect(() => { if (mounted) fetchAll(); }, [mounted]);

  const fetchAll = async () => {
    setLoading(true); setErr(null);
    try {
      const [aR,uR,sR] = await Promise.all([
        authFetch(`${API}/api/admin/analytics`),
        authFetch(`${API}/api/admin/users`),
        authFetch(`${API}/api/admin/scenarios`),
      ]);
      if (!aR.ok) throw new Error(`Analytics: ${aR.status}`);
      const aData:UserAnalytics[] = await aR.json();
      setAnalytics(aData);
      setUsers(await uR.json());
      setScenarios(await sR.json());
      if (aData.length>0) setSelected(aData[0]);
    } catch(e:any) { setErr(e?.message||"Gagal memuat data."); }
    finally { setLoading(false); }
  };

  const flash = (msg:string) => { setSuccess(msg); setTimeout(()=>setSuccess(null),3000); };

  const multiData  = useMemo(() => buildMultiData(analytics, activeDim), [analytics, activeDim]);
  const radarData  = useMemo(() => selected ? [
    {dim:"Kosakata",   value:selected.ma.range},
    {dim:"Tata Bahasa",value:selected.ma.accuracy},
    {dim:"Kelancaran", value:selected.ma.fluency},
    {dim:"Koherensi",  value:selected.ma.coherence},
    {dim:"Pelafalan",  value:selected.ma.phonology},
  ] : [], [selected]);

  const toggleRole = async (u:User) => {
    const nr = u.role==="admin"?"user":"admin";
    try {
      const r = await authFetch(`${API}/api/admin/users/${u.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({role:nr})});
      if (!r.ok) throw new Error(await r.text());
      setUsers(p=>p.map(x=>x.id===u.id?{...x,role:nr}:x));
      flash(`Role ${u.username} → ${nr}`);
    } catch(e:any){ setErr(e?.message); }
  };

  const toggleActive = async (u:User) => {
    try {
      const r = await authFetch(`${API}/api/admin/users/${u.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:!u.is_active})});
      if (!r.ok) throw new Error(await r.text());
      setUsers(p=>p.map(x=>x.id===u.id?{...x,is_active:!x.is_active}:x));
      flash(`${u.username} ${!u.is_active?"diaktifkan":"dinonaktifkan"}`);
    } catch(e:any){ setErr(e?.message); }
  };

  const addScenario = async (e:React.FormEvent) => {
    e.preventDefault(); if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const r = await authFetch(`${API}/api/admin/scenarios`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:newTitle.trim(),description:newDesc.trim()||null})});
      if (!r.ok) throw new Error(await r.text());
      const c = await r.json(); setScenarios(p=>[...p,c]); setNewTitle(""); setNewDesc("");
      flash(`Skenario "${c.title}" ditambahkan`);
    } catch(e:any){ setErr(e?.message); }
    finally { setSaving(false); }
  };

  const delScenario = async (id:number, title:string) => {
    if (!confirm(`Hapus "${title}"?`)) return;
    try {
      const r = await authFetch(`${API}/api/admin/scenarios/${id}`,{method:"DELETE"});
      if (!r.ok) throw new Error(await r.text());
      setScenarios(p=>p.filter(s=>s.id!==id)); flash(`"${title}" dihapus`);
    } catch(e:any){ setErr(e?.message); }
  };

  const logout = async () => {
    const { logout: lo } = await import("@/utils/auth");
    lo();
  };

  if (!mounted) return null;

  const card = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"20px" };
  const inputStyle = {
    background:"var(--surface2)", border:"1px solid var(--border2)",
    borderRadius:"12px", padding:"10px 14px", fontSize:14,
    color:"var(--text)", outline:"none", width:"100%",
  };

  // Stats
  const totalSessions = analytics.reduce((a,u)=>a+u.sessions_count,0);
  const userCount     = users.filter(u=>u.role==="user").length;
  const activeCount   = users.filter(u=>u.is_active&&u.role==="user").length;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b"
        style={{ background:dark?"rgba(12,12,16,0.92)":"rgba(246,246,248,0.92)", borderColor:"var(--border)" }}>
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {/* Logo */}
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:"var(--accent)" }}>
                <Icon.Mic width={13} height={13} style={{ stroke:"#0c0c10" }} />
              </div>
              <span className="text-sm font-semibold" style={{ color:"var(--text)" }}>SpeakEng</span>
            </Link>
            {/* Nav tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {(["analytics","users","scenarios"] as Tab[]).map(t => (
                <button key={t} onClick={()=>setTab(t)}
                  className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                  style={{
                    color:      tab===t?"var(--text)":"var(--text3)",
                    background: tab===t?"var(--border)":"transparent",
                    fontWeight: tab===t?500:400,
                  }}>
                  {t==="analytics"?"📈 Progres":t==="users"?`👥 Pengguna (${users.length})`:`📋 Skenario (${scenarios.length})`}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {/* User chip */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
              style={{ borderColor:"var(--border)", background:"var(--surface2)", color:"var(--text2)" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background:"rgba(245,158,11,0.15)", color:"var(--warn)" }}>
                {username[0]?.toUpperCase()}
              </div>
              <span>{username}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background:"rgba(245,158,11,0.1)", color:"var(--warn)" }}>Admin</span>
            </div>
            {/* Theme */}
            <button onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ color:"var(--text3)" }}>
              {dark?<Icon.Sun width={15} height={15}/>:<Icon.Moon width={15} height={15}/>}
            </button>
            {/* Logout */}
            <button onClick={logout}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{ color:"var(--text3)" }}
              onMouseEnter={e=>{e.currentTarget.style.color="var(--danger)";e.currentTarget.style.background="rgba(239,68,68,0.08)";}}
              onMouseLeave={e=>{e.currentTarget.style.color="var(--text3)";e.currentTarget.style.background="transparent";}}>
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-8">
        {/* ── Flash messages ── */}
        {success && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm"
            style={{ background:"rgba(0,200,150,0.08)", borderColor:"rgba(0,200,150,0.25)", color:"var(--accent)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background:"var(--accent)" }} />
            {success}
          </div>
        )}
        {err && (
          <div className="mb-4 flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border text-sm"
            style={{ background:"rgba(239,68,68,0.06)", borderColor:"rgba(239,68,68,0.2)", color:"var(--danger)" }}>
            <span>{err}</span>
            <button onClick={()=>setErr(null)} className="ml-4 text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label:"Total Pengguna",    value:userCount },
            { label:"Pengguna Aktif",    value:activeCount },
            { label:"Total Sesi",    value:totalSessions },
            { label:"Skenario",      value:scenarios.length },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5" style={card}>
              <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color:"var(--text3)" }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color:"var(--text)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Mobile tab switcher ── */}
        <div className="flex md:hidden gap-1 mb-6 p-1 rounded-2xl" style={{ background:"var(--surface2)" }}>
          {(["analytics","users","scenarios"] as Tab[]).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
              style={{ color:tab===t?"var(--text)":"var(--text3)", background:tab===t?"var(--surface)":"transparent" }}>
              {t==="analytics"?"Progres":t==="users"?"Pengguna":"Skenario"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3" style={{ color:"var(--text3)" }}>
            <Icon.Spinner width={18} height={18} />
            <span className="text-sm">Memuat data…</span>
          </div>
        ) : tab==="analytics" ? (

          /* ══════════════════════════════════════════
             TAB ANALYTICS — Multi-line progress chart
             ══════════════════════════════════════════ */
          <div className="space-y-5">

            {/* ── Multi-line chart ── */}
            <div className="rounded-3xl p-7" style={card}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color:"var(--text3)" }}>
                    Progres skor semua user
                  </p>
                  <p className="text-sm" style={{ color:"var(--text2)" }}>
                    Setiap garis = 1 pengguna · sumbu X = sesi · sumbu Y = skor (1–5)
                  </p>
                </div>
                {/* Dimension selector */}
                <div className="flex flex-wrap gap-1.5">
                  {DIM_OPTS.map(d => (
                    <button key={d.key} onClick={()=>setActiveDim(d.key)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                      style={{
                        color:      activeDim===d.key?"#0c0c10":"var(--text2)",
                        background: activeDim===d.key?"var(--accent)":"var(--surface2)",
                        borderColor:activeDim===d.key?"var(--accent)":"var(--border)",
                      }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {analytics.length===0 ? (
                <div className="h-64 flex flex-col items-center justify-center" style={{ color:"var(--text3)" }}>
                  <p className="text-3xl mb-3">📊</p>
                  <p className="text-sm">Belum ada data sesi latihan</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={multiData} margin={{ top:10, right:20, left:0, bottom:20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="session"
                        label={{ value:"Sesi ke-", position:"insideBottom", offset:-12, fontSize:11, fill:"var(--text3)" }}
                        tick={{ fontSize:11, fill:"var(--text3)" }} />
                      <YAxis domain={[1,5]} ticks={[1,2,3,4,5]}
                        label={{ value:"Skor", angle:-90, position:"insideLeft", offset:10, fontSize:11, fill:"var(--text3)" }}
                        tick={{ fontSize:11, fill:"var(--text3)" }} />
                      <Tooltip content={<MultiTooltip />} />
                      <Legend wrapperStyle={{ fontSize:12, paddingTop:20 }}
                        formatter={v=><span style={{color:"var(--text2)"}}>{v}</span>} />
                      {analytics.map((u,i) => (
                        <Line key={u.username} type="monotone" dataKey={u.username} name={u.username}
                          stroke={USER_COLORS[i%USER_COLORS.length]}
                          strokeWidth={selected?.user_id===u.user_id?2.5:1.5}
                          dot={{ r:selected?.user_id===u.user_id?4:2, strokeWidth:1 }}
                          activeDot={{ r:6 }} connectNulls
                          opacity={selected?selected.user_id===u.user_id?1:0.3:1} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* User pills */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="text-xs self-center" style={{ color:"var(--text3)" }}>Highlight:</span>
                    <button onClick={()=>setSelected(null)}
                      className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        color:      !selected?"#0c0c10":"var(--text3)",
                        background: !selected?"var(--text)":"transparent",
                        borderColor:!selected?"var(--text)":"var(--border2)",
                      }}>
                      Semua
                    </button>
                    {analytics.map((u,i) => (
                      <button key={u.user_id}
                        onClick={()=>setSelected(p=>p?.user_id===u.user_id?null:u)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
                        style={{
                          color:       selected?.user_id===u.user_id?"#0c0c10":"var(--text2)",
                          background:  selected?.user_id===u.user_id?USER_COLORS[i%USER_COLORS.length]:"transparent",
                          borderColor: USER_COLORS[i%USER_COLORS.length]+"60",
                        }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background:USER_COLORS[i%USER_COLORS.length] }} />
                        {u.username}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── Ranking + detail ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Ranking */}
              <div className="rounded-3xl overflow-hidden" style={card}>
                <div className="px-6 py-5 border-b" style={{ borderColor:"var(--border)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>
                    Peringkat pengguna
                  </p>
                  <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>Klik untuk melihat detail</p>
                </div>
                <div className="divide-y" style={{ borderColor:"var(--border)" }}>
                  {analytics.length===0 && (
                    <div className="p-6 text-center text-sm" style={{ color:"var(--text3)" }}>Belum ada data</div>
                  )}
                  {analytics.map((u,i) => (
                    <div key={u.user_id}
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors"
                      style={{ background:selected?.user_id===u.user_id?"var(--accent-dim)":"transparent" }}
                      onMouseEnter={e=>{if(selected?.user_id!==u.user_id) e.currentTarget.style.background="var(--surface2)";}}
                      onMouseLeave={e=>{if(selected?.user_id!==u.user_id) e.currentTarget.style.background="transparent";}}
                      onClick={()=>setSelected(p=>p?.user_id===u.user_id?null:u)}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background:USER_COLORS[i%USER_COLORS.length], color:"#0c0c10" }}>
                        {i+1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate" style={{ color:"var(--text)" }}>{u.username}</p>
                          <span className="text-sm font-bold flex-shrink-0" style={{ color:scoreCol(u.ma.overall) }}>
                            {u.ma.overall.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background:"var(--surface2)", color:"var(--text3)" }}>
                            L{u.level}
                          </span>
                          <span className="text-xs" style={{ color:"var(--text3)" }}>{u.sessions_count} sesi</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail user */}
              <div className="lg:col-span-2 rounded-3xl p-7" style={card}>
                {selected ? (
                  <>
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color:"var(--text3)" }}>
                          Detail progres
                        </p>
                        <h2 className="text-xl font-bold" style={{ color:"var(--text)" }}>{selected.username}</h2>
                        <p className="text-xs mt-1" style={{ color:"var(--text3)" }}>
                          {selected.sessions_count} sesi · {(selected.total_min/60).toFixed(1)} jam · Level {selected.level} · {selected.target_cefr}
                        </p>
                      </div>
                      <span className="text-xl font-black" style={{ color:"var(--accent)" }}>
                        {cefrKey(selected.ma.overall)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Radar */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-center" style={{ color:"var(--text3)" }}>
                          Profil kemampuan
                        </p>
                        <ResponsiveContainer width="100%" height={220}>
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="var(--border2)" />
                            <PolarAngleAxis dataKey="dim" tick={{ fontSize:11, fill:"var(--text2)" }} />
                            <PolarRadiusAxis angle={90} domain={[0,5]} tick={{ fontSize:9, fill:"var(--text3)" }} />
                            <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.18} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Score bars */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>
                          Skor per dimensi
                        </p>
                        <div className="space-y-3">
                          {(["range","accuracy","fluency","coherence","phonology"] as const).map(d => {
                            const val = selected.ma[d];
                            const col = scoreCol(val);
                            return (
                              <div key={d}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs" style={{ color:"var(--text2)" }}>{DIM_ID[d]}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold" style={{ color:col }}>{val.toFixed(1)}/5</span>
                                    <span className="text-[10px] font-semibold" style={{ color:"var(--text3)" }}>{cefrKey(val)}</span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full" style={{ background:"var(--border2)" }}>
                                  <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width:`${toP(val)}%`, background:col }} />
                                </div>
                              </div>
                            );
                          })}
                          <div className="pt-3 border-t" style={{ borderColor:"var(--border)" }}>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold" style={{ color:"var(--text)" }}>Overall</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold" style={{ color:"var(--accent)" }}>
                                  {selected.ma.overall.toFixed(1)}/5
                                </span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ background:"var(--accent-dim)", color:"var(--accent)", border:"1px solid var(--accent-border)" }}>
                                  {cefrKey(selected.ma.overall)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-16" style={{ color:"var(--text3)" }}>
                    <p className="text-4xl mb-3">👆</p>
                    <p className="font-medium text-sm" style={{ color:"var(--text2)" }}>Pilih pengguna dari peringkat</p>
                    <p className="text-xs mt-1">Klik nama pengguna untuk melihat detail progres</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        ) : tab==="users" ? (

          /* ══════════════════════
             TAB USERS
             ══════════════════════ */
          <div className="rounded-3xl overflow-hidden" style={card}>
            <div className="px-7 py-5 border-b" style={{ borderColor:"var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>
                Manajemen pengguna
              </p>
              <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>Kelola role dan status akun mahasiswa</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--border)" }}>
                    {["ID","Username","Email","Nama","Peran","Status","Login Terakhir","Aksi"].map(h => (
                      <th key={h} className="px-5 py-3 text-left whitespace-nowrap text-xs font-semibold uppercase tracking-wider"
                        style={{ color:"var(--text3)", background:"var(--surface2)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b transition-colors"
                      style={{ borderColor:"var(--border)" }}
                      onMouseEnter={e=>(e.currentTarget.style.background="var(--surface2)")}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <td className="px-5 py-4 text-xs" style={{ color:"var(--text3)" }}>{u.id}</td>
                      <td className="px-5 py-4 font-medium" style={{ color:"var(--text)" }}>{u.username}</td>
                      <td className="px-5 py-4 text-xs" style={{ color:"var(--text2)" }}>{u.email}</td>
                      <td className="px-5 py-4 text-xs" style={{ color:"var(--text2)" }}>{u.full_name||"—"}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={u.role==="admin"
                            ? {color:"var(--warn)",background:"rgba(245,158,11,0.1)"}
                            : {color:"var(--accent)",background:"var(--accent-dim)"}}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={u.is_active
                            ? {color:"var(--accent)",background:"var(--accent-dim)"}
                            : {color:"var(--danger)",background:"rgba(239,68,68,0.08)"}}>
                          {u.is_active?"Aktif":"Nonaktif"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs whitespace-nowrap" style={{ color:"var(--text3)" }}>
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString("id-ID",{dateStyle:"short",timeStyle:"short"})
                          : "Belum pernah"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={()=>toggleRole(u)} disabled={u.id===1}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 whitespace-nowrap"
                            style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface2)" }}
                            onMouseEnter={e=>{ if(u.id!==1){ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text)"; }}}
                            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.color="var(--text2)"; }}>
                            {u.role==="admin"?"→ User":"→ Admin"}
                          </button>
                          <button onClick={()=>toggleActive(u)} disabled={u.id===1}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 whitespace-nowrap"
                            style={u.is_active
                              ? {color:"var(--danger)",borderColor:"rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.06)"}
                              : {color:"var(--accent)",borderColor:"var(--accent-border)",background:"var(--accent-dim)"}}>
                            {u.is_active?"Nonaktifkan":"Aktifkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length===0 && (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-sm" style={{ color:"var(--text3)" }}>
                      Belum ada pengguna.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        ) : (

          /* ══════════════════════
             TAB SCENARIOS
             ══════════════════════ */
          <div className="space-y-5">
            {/* Add form */}
            <div className="rounded-3xl p-7" style={card}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color:"var(--text3)" }}>
                Tambah skenario baru
              </p>
              <form onSubmit={addScenario} className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="Judul skenario *" value={newTitle}
                  onChange={e=>setNewTitle(e.target.value)} required style={inputStyle}
                  onFocus={e=>(e.currentTarget.style.borderColor="var(--accent)")}
                  onBlur={e=>(e.currentTarget.style.borderColor="var(--border2)")} />
                <input type="text" placeholder="Deskripsi (opsional)" value={newDesc}
                  onChange={e=>setNewDesc(e.target.value)} style={inputStyle}
                  onFocus={e=>(e.currentTarget.style.borderColor="var(--accent)")}
                  onBlur={e=>(e.currentTarget.style.borderColor="var(--border2)")} />
                <button type="submit" disabled={saving||!newTitle.trim()}
                  className="px-6 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap"
                  style={{ background:"var(--accent)", color:"#0c0c10" }}>
                  {saving?"Menyimpan…":"+ Tambah"}
                </button>
              </form>
            </div>

            {/* List */}
            <div className="rounded-3xl overflow-hidden" style={card}>
              <div className="px-7 py-5 border-b" style={{ borderColor:"var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>
                  Daftar skenario ({scenarios.length})
                </p>
              </div>
              <div className="divide-y" style={{ borderColor:"var(--border)" }}>
                {scenarios.map(s => (
                  <div key={s.id}
                    className="flex items-center justify-between px-7 py-5 transition-colors"
                    onMouseEnter={e=>(e.currentTarget.style.background="var(--surface2)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <div>
                      <p className="font-medium" style={{ color:"var(--text)" }}>{s.title}</p>
                      <p className="text-sm mt-0.5" style={{ color:"var(--text3)" }}>{s.description||"—"}</p>
                    </div>
                    <button onClick={()=>delScenario(s.id,s.title)}
                      className="ml-6 px-3 py-1.5 rounded-xl text-xs font-medium border flex-shrink-0 transition-all"
                      style={{ color:"var(--danger)", borderColor:"rgba(239,68,68,0.25)", background:"rgba(239,68,68,0.06)" }}
                      onMouseEnter={e=>{ e.currentTarget.style.background="rgba(239,68,68,0.12)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background="rgba(239,68,68,0.06)"; }}>
                      Hapus
                    </button>
                  </div>
                ))}
                {scenarios.length===0 && (
                  <div className="py-12 text-center text-sm" style={{ color:"var(--text3)" }}>
                    Belum ada skenario.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}