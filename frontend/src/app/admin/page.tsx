"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { authFetch, TokenStore } from "@/utils/auth";
import { useTheme, Icon } from "@/components/shared";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type UserAnalytics = {
  user_id: number; username: string; full_name: string; is_active: boolean;
  last_login: string | null; sessions_count: number; total_min: number;
  level: number; target_cefr: string;
  ma: { range:number; accuracy:number; fluency:number; coherence:number; interaction:number; overall:number };
  score_trend: { session:number; overall:number; range:number; accuracy:number; fluency:number; coherence:number; interaction:number; date:string; scenario:string }[];
};
type Scenario = { id:number; title:string; description:string|null };
type User     = { id:number; username:string; email:string; full_name:string|null; role:string; is_active:boolean; created_at:string; last_login_at:string|null };
type Session  = { id:number; scenario:string; audio_path:string|null; duration_min:number; created_at:string; ai_scores:Record<string,number>; rater_scores:Record<number,Record<string,number>>; rating_status:{rater_1_done:boolean;rater_2_done:boolean;both_done:boolean} };
type Tab      = "analytics" | "users" | "scenarios" | "rater";
type Dim      = "overall"|"range"|"accuracy"|"fluency"|"coherence"|"interaction";

// ─── Constants ────────────────────────────────────────────────────────────────
const USER_COLORS = ["#00c896","#818cf8","#f472b6","#fbbf24","#60a5fa","#34d399","#f87171","#a78bfa","#fb923c","#38bdf8"];
const DIM_OPTS: { key: Dim; label: string }[] = [
  { key:"overall",   label:"Overall" },
  { key:"range",     label:"Kosakata" },
  { key:"accuracy",  label:"Tata Bahasa" },
  { key:"fluency",   label:"Kelancaran" },
  { key:"coherence", label:"Koherensi" },
  { key:"interaction", label:"Interaksi" },
];
const DIM_ID: Record<string,string> = {
  range:"Kosakata", accuracy:"Tata Bahasa", fluency:"Kelancaran", coherence:"Koherensi", interaction:"Interaksi",
};
const RATER_DIMS = [
  { key:"range",     label:"Kosakata" },
  { key:"accuracy",  label:"Tata Bahasa" },
  { key:"fluency",   label:"Kelancaran" },
  { key:"coherence", label:"Koherensi" },
  { key:"interaction", label:"Interaksi" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cefrKey(s:number){ if(s>=5.0)return"C2"; if(s>=4.0)return"C1"; if(s>=3.0)return"B2"; if(s>=2.0)return"B1"; return"A2"; }
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

  // ── Rater tab state ──────────────────────────────────────────────────────────
  const [raterSessions,    setRaterSessions]    = useState<Session[]>([]);
  const [raterLoading,     setRaterLoading]     = useState(false);
  const [selectedRaterSes, setSelectedRaterSes] = useState<Session|null>(null);
  const [raterNum,         setRaterNum]         = useState<1|2>(1);
  const [raterScores,      setRaterScores]      = useState<Record<string,number>>({});
  const [raterNotes,       setRaterNotes]       = useState("");
  const [raterSaving,      setRaterSaving]      = useState(false);
  const [correlations,     setCorrelations]     = useState<any>(null);
  const [corrLoading,      setCorrLoading]      = useState(false);
  const [confirmAction,    setConfirmAction]    = useState<{ type:"role"|"active"; user:User; newRole?:string }|null>(null);

  useEffect(() => {
    setMounted(true);
    if (!TokenStore.isLoggedIn()) { window.location.href="/auth"; return; }
    if (TokenStore.getRole()!=="admin") { window.location.href="/practice"; return; }
    setUsername(TokenStore.getUsername()||"admin");
  }, []);

  useEffect(() => { if (mounted) fetchAll(); }, [mounted]);
  useEffect(() => { if (tab==="rater" && mounted && raterSessions.length===0) loadRaterSessions(); }, [tab, mounted]);
  useEffect(() => {
    if (!selectedRaterSes) return;
    const existing = selectedRaterSes.rater_scores[raterNum];
    if (existing) {
      const pf: Record<string,number> = {};
      for (const d of RATER_DIMS) { if (existing[d.key]!=null) pf[d.key]=existing[d.key]; }
      setRaterScores(pf);
    } else { setRaterScores(Object.fromEntries(RATER_DIMS.map(d => [d.key, 3]))); }
  }, [raterNum, selectedRaterSes]);

  const fetchAll = async () => {
    setLoading(true); setErr(null);
    try {
      const [aR,uR,sR] = await Promise.all([
        authFetch(`${API}/api/admin/analytics`),
        authFetch(`${API}/api/admin/users`),
        authFetch(`${API}/api/admin/scenarios`),
      ]);
      if (!aR.ok) throw new Error(`Analytics: ${aR.status}`);
      if (!uR.ok) throw new Error(`Users: ${uR.status}`);
      if (!sR.ok) throw new Error(`Scenarios: ${sR.status}`);
      const aData:UserAnalytics[] = await aR.json();
      setAnalytics(aData);
      setUsers(await uR.json());
      setScenarios(await sR.json());
      if (aData.length>0) setSelected(aData[0]);
    } catch(e:any) { setErr(e?.message||"Gagal memuat data."); }
    finally { setLoading(false); }
  };

  const flash = (msg:string) => { setSuccess(msg); setTimeout(()=>setSuccess(null),3000); };

  const loadRaterSessions = async () => {
    setRaterLoading(true);
    try {
      const r = await authFetch(`${API}/api/admin/validation/sessions`);
      if (!r.ok) throw new Error(`Rater sessions: ${r.status}`);
      setRaterSessions(await r.json());
    } catch(e:any) { setErr(e?.message); }
    finally { setRaterLoading(false); }
  };

  const loadCorrelations = async () => {
    setCorrLoading(true);
    try {
      const r = await authFetch(`${API}/api/admin/validation/correlations`);
      if (!r.ok) throw new Error(`Correlations: ${r.status}`);
      setCorrelations(await r.json());
    } catch(e:any) { setErr(e?.message); }
    finally { setCorrLoading(false); }
  };

  const selectRaterSession = (s: Session) => {
    setSelectedRaterSes(s);
    const existing = s.rater_scores[raterNum];
    if (existing) {
      const pf: Record<string,number> = {};
      for (const d of RATER_DIMS) { if (existing[d.key]!=null) pf[d.key]=existing[d.key]; }
      setRaterScores(pf);
    } else { setRaterScores(Object.fromEntries(RATER_DIMS.map(d => [d.key, 3]))); }
    setRaterNotes("");
  };

  const saveRaterScore = async () => {
    if (!selectedRaterSes) return;
    setRaterSaving(true);
    try {
      const r = await authFetch(`${API}/api/admin/validation/assessments`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          session_id:    selectedRaterSes.id,
          rater_id:      raterNum,
          score_range:   raterScores.range    || null,
          score_accuracy:raterScores.accuracy || null,
          score_fluency: raterScores.fluency  || null,
          score_coherence:raterScores.coherence||null,
          score_interaction:raterScores.interaction||null,
          notes: raterNotes || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      flash("Penilaian disimpan!");
      setSelectedRaterSes(null);
      loadRaterSessions();
    } catch(e:any) { setErr(e?.message); }
    finally { setRaterSaving(false); }
  };

  const multiData  = useMemo(() => buildMultiData(analytics, activeDim), [analytics, activeDim]);
  const radarData  = useMemo(() => selected ? [
    {dim:"Kosakata",   value:selected.ma.range},
    {dim:"Tata Bahasa",value:selected.ma.accuracy},
    {dim:"Kelancaran", value:selected.ma.fluency},
    {dim:"Koherensi",  value:selected.ma.coherence},
    {dim:"Interaksi",  value:selected.ma.interaction},
  ] : [], [selected]);

  const setRole = async (u:User, nr:string) => {
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

  if (!mounted) return <div style={{ minHeight:"100vh", background:"var(--bg)" }} />;

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
              <span className="text-sm font-semibold" style={{ color:"var(--text)" }}>BicarAI</span>
            </Link>
            {/* Nav tabs */}
            {/* Tab nav — uppercase + letter-spacing untuk rasa premium ala Linear */}
            <nav className="hidden md:flex items-center gap-0.5">
              {(["analytics","users","scenarios","rater"] as Tab[]).map(t => (
                <button key={t} onClick={()=>setTab(t)}
                  className="px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    fontSize:      11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight:    tab===t ? 700 : 500,
                    color:         tab===t ? "var(--text)" : "var(--text3)",
                    background:    tab===t ? "var(--border)" : "transparent",
                  }}>
                  {t==="analytics"?"Progres":t==="users"?`Pengguna (${users.length})`:t==="scenarios"?`Skenario (${scenarios.length})`:"Rater"}
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

        {/* ── Stats row — hero stat kiri, 3 kecil vertikal di kanan ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Hero stat: Total Sesi — angka besar karena ini KPI utama validasi */}
          <div className="sm:flex-[2] rounded-2xl px-7 py-6" style={card}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>
              Total Sesi Latihan
            </p>
            <p className="font-black leading-none mb-2" style={{ fontSize:72, color:"var(--text)", lineHeight:1 }}>
              {totalSessions}
            </p>
            <p className="text-xs mt-3" style={{ color:"var(--text3)" }}>sesi tercatat di database</p>
          </div>
          {/* 3 stat kecil stacked — density rapat untuk kontras dengan hero */}
          <div className="sm:flex-1 flex flex-row sm:flex-col gap-3">
            {[
              { label:"Pengguna",         value:userCount },
              { label:"Pengguna Aktif",   value:activeCount },
              { label:"Skenario",         value:scenarios.length },
            ].map(s => (
              <div key={s.label} className="flex-1 rounded-2xl px-4 py-3 flex items-center justify-between gap-4" style={card}>
                <p className="text-[11px] font-medium uppercase tracking-wider leading-tight" style={{ color:"var(--text3)" }}>{s.label}</p>
                <p className="text-2xl font-black tabular-nums" style={{ color:"var(--text)", lineHeight:1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mobile tab switcher ── */}
        <div className="flex md:hidden gap-1 mb-6 p-1 rounded-2xl" style={{ background:"var(--surface2)" }}>
          {(["analytics","users","scenarios","rater"] as Tab[]).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
              style={{ color:tab===t?"var(--text)":"var(--text3)", background:tab===t?"var(--surface)":"transparent" }}>
              {t==="analytics"?"Progres":t==="users"?"Pengguna":t==="scenarios"?"Skenario":"Rater"}
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
                          {(["range","accuracy","fluency","coherence","interaction"] as const).map(d => {
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
                            ? {color:"var(--warn)",  background:"rgba(245,158,11,0.1)"}
                            : u.role==="rater1"
                            ? {color:"#818cf8",      background:"rgba(129,140,248,0.1)"}
                            : u.role==="rater2"
                            ? {color:"#a78bfa",      background:"rgba(167,139,250,0.1)"}
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
                          {/* Tombol rater1/rater2 — hanya muncul untuk non-admin */}
                          {u.role !== "admin" && u.role !== "rater1" && (
                            <button onClick={()=>setConfirmAction({type:"role",user:u,newRole:"rater1"})} disabled={u.id===1}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 whitespace-nowrap"
                              style={{ color:"#818cf8", borderColor:"rgba(129,140,248,0.3)", background:"rgba(129,140,248,0.08)" }}>
                              → Rater 1
                            </button>
                          )}
                          {u.role !== "admin" && u.role !== "rater2" && (
                            <button onClick={()=>setConfirmAction({type:"role",user:u,newRole:"rater2"})} disabled={u.id===1}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 whitespace-nowrap"
                              style={{ color:"#a78bfa", borderColor:"rgba(167,139,250,0.3)", background:"rgba(167,139,250,0.08)" }}>
                              → Rater 2
                            </button>
                          )}
                          {(u.role==="rater1"||u.role==="rater2") && (
                            <button onClick={()=>setConfirmAction({type:"role",user:u,newRole:"user"})} disabled={u.id===1}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 whitespace-nowrap"
                              style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface2)" }}>
                              → User
                            </button>
                          )}
                          <button onClick={()=>setConfirmAction({type:"role",user:u,newRole:u.role==="admin"?"user":"admin"})} disabled={u.id===1}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 whitespace-nowrap"
                            style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface2)" }}
                            onMouseEnter={e=>{ if(u.id!==1){ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text)"; }}}
                            onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border2)"; e.currentTarget.style.color="var(--text2)"; }}>
                            {u.role==="admin"?"→ User":"→ Admin"}
                          </button>
                          <button onClick={()=>setConfirmAction({type:"active",user:u})} disabled={u.id===1}
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

        ) : tab==="scenarios" ? (

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

        ) : (

          /* ══════════════════════
             TAB RATER
             ══════════════════════ */
          <div className="space-y-5">

            {/* ── Sessions list + Scoring form ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

              {/* Sessions list */}
              <div className="rounded-3xl overflow-hidden" style={card}>
                <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor:"var(--border)" }}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>
                      Daftar Sesi ({raterSessions.length})
                    </p>
                    <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>Klik untuk menilai</p>
                  </div>
                  <button onClick={loadRaterSessions} disabled={raterLoading}
                    className="text-xs px-3 py-1.5 rounded-xl border transition-colors disabled:opacity-40"
                    style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface2)" }}>
                    {raterLoading ? "…" : "Refresh"}
                  </button>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight:520 }}>
                  {raterLoading ? (
                    <div className="flex items-center justify-center h-32 gap-2" style={{ color:"var(--text3)" }}>
                      <Icon.Spinner width={16} height={16} />
                      <span className="text-sm">Memuat…</span>
                    </div>
                  ) : raterSessions.length===0 ? (
                    <div className="p-8 text-center text-sm" style={{ color:"var(--text3)" }}>
                      Belum ada sesi dengan rekaman audio
                    </div>
                  ) : raterSessions.map(s => (
                    /* Session item — editorial: judul besar, metadata kecil, badge kanan */
                    <button key={s.id} onClick={() => selectRaterSession(s)}
                      className="w-full text-left px-5 py-4 border-b transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        background:  selectedRaterSes?.id===s.id ? "var(--accent-dim)" : "transparent",
                      }}
                      onMouseEnter={e => { if(selectedRaterSes?.id!==s.id) e.currentTarget.style.background="var(--surface2)"; }}
                      onMouseLeave={e => { if(selectedRaterSes?.id!==s.id) e.currentTarget.style.background="transparent"; }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {/* Judul skenario lebih besar — hierarki visual jelas */}
                          <p className="text-sm font-semibold leading-snug truncate" style={{ color:"var(--text)" }}>
                            {s.scenario}
                          </p>
                          {/* Metadata sebagai baris kedua kecil */}
                          <p className="text-[11px] mt-1 tabular-nums" style={{ color:"var(--text3)" }}>
                            {new Date(s.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short" })}
                            <span className="mx-1.5" style={{ color:"var(--border2)" }}>·</span>
                            {s.duration_min.toFixed(1)} mnt
                            <span className="mx-1.5" style={{ color:"var(--border2)" }}>·</span>
                            <span style={{ color:"var(--text3)" }}>#{s.id}</span>
                          </p>
                        </div>
                        {/* Badge di kanan — status langsung terlihat tanpa scanning */}
                        <div className="flex flex-col gap-1 flex-shrink-0 items-end pt-0.5">
                          {s.rating_status.rater_1_done && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background:"var(--accent-dim)", color:"var(--accent)", border:"1px solid var(--accent-border)" }}>
                              R1 ✓
                            </span>
                          )}
                          {s.rating_status.rater_2_done && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background:"rgba(245,158,11,0.1)", color:"var(--warn)", border:"1px solid rgba(245,158,11,0.3)" }}>
                              R2 ✓
                            </span>
                          )}
                          {!s.rating_status.rater_1_done && !s.rating_status.rater_2_done && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ background:"var(--surface2)", color:"var(--text3)", border:"1px solid var(--border)" }}>
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Audio + Scoring Form */}
              {selectedRaterSes ? (
                <div className="lg:col-span-2 space-y-4">

                  {/* Audio player */}
                  <div className="rounded-3xl p-6" style={card}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>
                      Rekaman Audio — {selectedRaterSes.scenario}
                    </p>
                    {selectedRaterSes.audio_path ? (
                      <audio key={selectedRaterSes.id} controls className="w-full" style={{ borderRadius:12 }}>
                        <source src={`${API}/uploads/audio/${selectedRaterSes.audio_path}`} type="audio/wav" />
                        Browser tidak support audio
                      </audio>
                    ) : (
                      <p className="text-sm" style={{ color:"var(--danger)" }}>Audio tidak tersedia</p>
                    )}
                    <div className="grid grid-cols-3 gap-4 mt-4 text-xs">
                      <div>
                        <p style={{ color:"var(--text3)" }}>Durasi</p>
                        <p className="font-semibold" style={{ color:"var(--text)" }}>{selectedRaterSes.duration_min.toFixed(1)} menit</p>
                      </div>
                      <div>
                        <p style={{ color:"var(--text3)" }}>Tanggal</p>
                        <p className="font-semibold" style={{ color:"var(--text)" }}>{new Date(selectedRaterSes.created_at).toLocaleDateString("id-ID")}</p>
                      </div>
                      <div>
                        <p style={{ color:"var(--text3)" }}>Sesi ID</p>
                        <p className="font-semibold" style={{ color:"var(--text)" }}>#{selectedRaterSes.id}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Scores reference */}
                  <div className="rounded-3xl p-6" style={card}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>
                      Skor AI (referensi)
                    </p>
                    <div className="grid grid-cols-5 gap-3">
                      {RATER_DIMS.map(d => (
                        <div key={d.key} className="text-center">
                          <p className="text-xs mb-1" style={{ color:"var(--text3)" }}>{d.label}</p>
                          <p className="text-xl font-bold" style={{ color:"var(--accent)" }}>
                            {selectedRaterSes.ai_scores[d.key]?.toFixed(1) || "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scoring form */}
                  <div className="rounded-3xl p-6" style={card}>
                    <div className="flex items-center justify-between mb-5">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>
                        Penilaian Rater
                      </p>
                      <div className="flex gap-2">
                        {([1,2] as const).map(n => (
                          <button key={n} onClick={() => setRaterNum(n)}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold border transition-all"
                            style={{
                              color:       raterNum===n ? "#0c0c10" : "var(--text2)",
                              background:  raterNum===n ? "var(--accent)" : "var(--surface2)",
                              borderColor: raterNum===n ? "var(--accent)" : "var(--border2)",
                            }}>
                            Rater {n}{n===1 ? (selectedRaterSes.rating_status.rater_1_done?" ✓":"") : (selectedRaterSes.rating_status.rater_2_done?" ✓":"")}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {RATER_DIMS.map(d => (
                        <div key={d.key}>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium" style={{ color:"var(--text)" }}>{d.label}</label>
                            <span className="text-sm font-bold" style={{ color:"var(--accent)" }}>
                              {raterScores[d.key]?.toFixed(1) || "—"} / 5
                            </span>
                          </div>
                          <input type="range" min="1" max="5" step="0.5"
                            value={raterScores[d.key] || 3}
                            onChange={e => setRaterScores(p => ({ ...p, [d.key]: parseFloat(e.target.value) }))}
                            className="w-full" />
                        </div>
                      ))}

                      <div>
                        <label className="text-sm font-medium block mb-2" style={{ color:"var(--text)" }}>
                          Catatan (opsional)
                        </label>
                        <textarea value={raterNotes} onChange={e => setRaterNotes(e.target.value)}
                          rows={2} placeholder="Tulis catatan atau observasi…"
                          className="w-full px-3 py-2 rounded-xl text-sm"
                          style={{ background:"var(--surface2)", color:"var(--text)", border:"1px solid var(--border)", outline:"none", resize:"vertical" }} />
                      </div>

                      <div className="flex gap-3">
                        <button onClick={() => setSelectedRaterSes(null)}
                          className="px-5 py-2.5 rounded-2xl text-sm font-medium border transition-all"
                          style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface2)" }}>
                          Batal
                        </button>
                        <button onClick={saveRaterScore} disabled={raterSaving}
                          className="flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
                          style={{ background:"var(--accent)", color:"#0c0c10" }}>
                          {raterSaving ? "Menyimpan…" : "Simpan Penilaian"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty state — bukan placeholder, tapi instruksi bermakna */
                <div className="lg:col-span-2 rounded-3xl px-10 py-12 flex flex-col justify-center" style={card}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--accent)" }}>
                    Panduan Penilaian
                  </p>
                  <h3 className="text-xl font-bold mb-3 leading-snug" style={{ color:"var(--text)" }}>
                    Pilih sesi dari daftar untuk mulai menilai
                  </h3>
                  <p className="text-sm leading-relaxed mb-8" style={{ color:"var(--text2)", maxWidth:420 }}>
                    Penilaianmu akan disimpan sebagai <em>ground truth</em> untuk mengukur seberapa akurat sistem AI
                    menilai kemampuan berbicara mahasiswa. Setiap sesi dinilai oleh dua rater secara independen.
                  </p>
                  <div className="space-y-4">
                    {[
                      { n:"01", t:"Pilih sesi",           d:"Klik sesi dari daftar yang memiliki rekaman audio" },
                      { n:"02", t:"Dengarkan rekaman",    d:"Nilai tanpa melihat skor AI terlebih dahulu" },
                      { n:"03", t:"Beri skor per dimensi",d:"Range · Accuracy · Fluency · Coherence · Interaction" },
                    ].map(({ n, t, d }) => (
                      <div key={n} className="flex items-start gap-4">
                        <span className="text-[11px] font-black tabular-nums pt-0.5 flex-shrink-0"
                          style={{ color:"var(--accent)", minWidth:20 }}>{n}</span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color:"var(--text)" }}>{t}</p>
                          <p className="text-[11px] mt-0.5" style={{ color:"var(--text3)" }}>{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Correlations ── */}
            <div className="rounded-3xl p-7" style={card}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>
                    Analisis Korelasi
                  </p>
                  <p className="text-xs mt-0.5" style={{ color:"var(--text3)" }}>
                    Spearman ρ antara skor AI dan rater manusia
                  </p>
                </div>
                <button onClick={loadCorrelations} disabled={corrLoading}
                  className="px-5 py-2 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
                  style={{ background:"var(--accent)", color:"#0c0c10" }}>
                  {corrLoading ? "Menghitung…" : "Hitung Korelasi"}
                </button>
              </div>

              {correlations ? (
                correlations.sample_size < 3 ? (
                  <div className="rounded-2xl p-6 text-center" style={{ background:"var(--surface2)" }}>
                    <p className="text-2xl mb-3">📊</p>
                    <p className="text-sm font-semibold mb-1" style={{ color:"var(--text)" }}>
                      Data belum cukup untuk hitung korelasi
                    </p>
                    <p className="text-xs mb-4" style={{ color:"var(--text3)" }}>
                      Korelasi Spearman butuh minimal 3 sesi yang dinilai oleh <strong>kedua rater</strong>.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                        style={{ background:"rgba(0,200,150,0.08)", color:"var(--accent)", border:"1px solid var(--accent-border)" }}>
                        <span>Sesi dinilai kedua rater</span>
                        <span className="text-lg font-black">{correlations.sample_size}</span>
                        <span style={{ color:"var(--text3)" }}>/ min. 3</span>
                      </div>
                    </div>
                    <p className="text-xs mt-4" style={{ color:"var(--text3)" }}>
                      Pilih sesi di atas, nilai sebagai Rater 1, lalu nilai sesi yang sama sebagai Rater 2 — ulangi untuk minimal 3 sesi.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs" style={{ color:"var(--text3)" }}>
                      n = {correlations.sample_size} sesi dinilai kedua rater · ρ = Spearman rho
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Kolom utama: AI vs Rata-rata Rater — ini yang masuk ke dokumen TA */}
                      {(["ai_vs_avg_rater","rater1_vs_rater2","ai_vs_rater1","ai_vs_rater2"] as const).map(k => (
                        <div key={k} className="p-5 rounded-2xl" style={{
                          background:"var(--surface2)",
                          border: k==="ai_vs_avg_rater" ? "1px solid var(--accent)" : "none"
                        }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: k==="ai_vs_avg_rater"?"var(--accent)":"var(--text3)" }}>
                            {k==="ai_vs_avg_rater"
                              ? "★ AI vs Rata-rata Rater (ground truth)"
                              : k==="rater1_vs_rater2"
                              ? "Rater 1 vs Rater 2 (inter-rater)"
                              : k==="ai_vs_rater1"
                              ? "AI vs Rater 1"
                              : "AI vs Rater 2"}
                          </p>
                          {k==="ai_vs_avg_rater" && (
                            <p className="text-[10px] mb-3" style={{ color:"var(--text3)" }}>
                              Kolom ini yang digunakan sebagai validasi utama di dokumen TA
                            </p>
                          )}
                          <div className="space-y-2">
                            {RATER_DIMS.map(d => {
                              const data = correlations[k]?.[d.key];
                              if (!data || data.insufficient || data.r == null) {
                                return (
                                  <div key={d.key} className="flex justify-between text-xs">
                                    <span style={{ color:"var(--text2)" }}>{d.label}</span>
                                    <span style={{ color:"var(--text3)" }}>— data kurang</span>
                                  </div>
                                );
                              }
                              const col = data.r>0.7?"var(--accent)":data.r>0.5?"var(--warn)":"var(--danger)";
                              return (
                                <div key={d.key} className="flex justify-between text-xs">
                                  <span style={{ color:"var(--text2)" }}>{d.label}</span>
                                  <span className="font-bold" style={{ color:col }}>ρ = {data.r.toFixed(3)}</span>
                                </div>
                              );
                            })}
                            {correlations[k]?.overall && (
                              <div className="flex justify-between text-xs pt-2 border-t font-bold" style={{ borderColor:"var(--border)" }}>
                                <span style={{ color:"var(--text)" }}>Overall</span>
                                <span style={{ color:"var(--accent)" }}>ρ = {correlations[k].overall.r.toFixed(3)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-sm" style={{ color:"var(--text3)" }}>
                  Klik "Hitung Korelasi" untuk melihat analisis
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* ── Confirmation Modal ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }}
          onClick={()=>setConfirmAction(null)}>
          <div className="rounded-2xl p-6 max-w-sm w-full"
            style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={e=>e.stopPropagation()}>
            <p className="font-semibold mb-2" style={{ color:"var(--text)" }}>
              {confirmAction.type === "active"
                ? `${confirmAction.user.is_active ? "Nonaktifkan" : "Aktifkan"} akun "${confirmAction.user.username}"?`
                : `Ubah role "${confirmAction.user.username}" → ${confirmAction.newRole}?`}
            </p>
            <p className="text-sm mb-5" style={{ color:"var(--text3)" }}>
              {confirmAction.type === "active" && confirmAction.user.is_active
                ? "User tidak dapat login setelah dinonaktifkan."
                : confirmAction.type === "active"
                ? "User akan dapat login kembali."
                : "Hak akses user akan berubah sesuai role baru."}
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
                style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface2)" }}>
                Batal
              </button>
              <button onClick={()=>{
                  if (confirmAction.type === "active") toggleActive(confirmAction.user);
                  else setRole(confirmAction.user, confirmAction.newRole!);
                  setConfirmAction(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
                style={{
                  background: confirmAction.type === "active" && confirmAction.user.is_active ? "var(--danger)" : "var(--accent)",
                  color:      confirmAction.type === "active" && confirmAction.user.is_active ? "#fff" : "#0c0c10",
                }}>
                Ya, lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}