"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch, TokenStore } from "@/utils/auth";
import { NavBar, Icon, useTheme } from "@/components/shared";

type Profile = {
  level: number; target_cefr: string; sessions_count: number;
  ma: { range: number; accuracy: number; fluency: number; coherence: number; phonology: number; overall: number };
};
type Session = { id: number; scenario: string; score_overall: number; created_at: string };
type Stats   = { total_minutes: number; total_hours: number };

const DIM: Record<string, string> = {
  range:"Kosakata", accuracy:"Tata Bahasa", fluency:"Kelancaran", coherence:"Koherensi", phonology:"Pelafalan",
};
const TIPS: Record<string, string> = {
  range:     "Baca artikel bahasa Inggris setiap hari dan catat kosakata baru.",
  accuracy:  "Fokus latihan tense dan artikel. Minta AI koreksi setiap kalimatmu.",
  fluency:   "Latih berbicara tanpa berhenti. Gunakan filler alami seperti 'well', 'you see'.",
  coherence: "Struktur jawaban: point → reason → example. Gunakan 'first, then, finally'.",
  phonology: "Dengarkan podcast native speaker dan tiru intonasi mereka.",
};
// Deskripsi 1 kalimat per level — memberi konteks emosional pada angka CEFR
const CEFR_DESC: Record<string, string> = {
  "C1+": "Setara kemampuan akademik dan profesional tinggi.",
  "B2":  "Mampu berkomunikasi lancar dalam berbagai konteks.",
  "B1":  "Dapat mengatasi sebagian besar situasi sehari-hari.",
  "A2":  "Mampu berkomunikasi dalam situasi sederhana.",
  "A1":  "Kemampuan dasar dalam komunikasi terbatas.",
};
function cefrKey(s: number) {
  if (s >= 4.5) return "C1+"; if (s >= 3.5) return "B2"; if (s >= 2.5) return "B1"; if (s >= 1.5) return "A2"; return "A1";
}
function toP(s: number) { return Math.max(0, Math.min(100, ((s-1)/4)*100)); }
function scoreCol(s: number) {
  return s >= 3.5 ? "var(--accent)" : s >= 2.5 ? "var(--warn)" : "var(--danger)";
}

export default function DashboardPage() {
  const API  = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/,"");
  const { dark } = useTheme();

  const [profile, setProfile]   = useState<Profile|null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats]       = useState<Stats|null>(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState<string|null>(null);
  const [username, setUsername] = useState("");
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!TokenStore.isLoggedIn()) { window.location.href="/auth"; return; }
    if (TokenStore.getRole()==="admin") { window.location.href="/admin"; return; }
    setUsername(TokenStore.getUsername()||"");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const [pR,sR,stR] = await Promise.all([
          authFetch(`${API}/api/profile`),
          authFetch(`${API}/api/sessions/recent?limit=8`),
          authFetch(`${API}/api/sessions/stats`),
        ]);
        if (!pR.ok||!sR.ok||!stR.ok) throw new Error("Gagal memuat data.");
        if (alive) { setProfile(await pR.json()); setSessions(await sR.json()); setStats(await stR.json()); }
      } catch(e:any) { if(alive) setErr(e?.message); }
      finally { if(alive) setLoading(false); }
    })();
    return () => { alive=false; };
  }, [mounted, API]);

  const overall   = profile?.ma?.overall ?? 0;
  const weakDim   = profile
    ? Object.entries(profile.ma).filter(([k])=>k!=="overall").sort(([,a],[,b])=>a-b)[0]?.[0]
    : null;
  const fmt = useMemo(() => new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}), []);

  if (!mounted) return <div style={{ minHeight:"100vh", background:"var(--bg)" }} />;

  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? "pagi" : hour < 18 ? "siang" : "malam";

  // Card style helper
  const card = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "20px",
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <NavBar
        links={[
          { label:"Latihan", href:"/practice" },
          { label:"Dashboard", href:"/dashboard", active:true },
        ]}
      />

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        {loading && (
          <div className="flex items-center justify-center h-48 gap-3" style={{ color:"var(--text3)" }}>
            <Icon.Spinner width={18} height={18} />
            <span className="text-sm">Memuat…</span>
          </div>
        )}

        {!loading && err && (
          <div className="rounded-2xl p-6 text-center border"
            style={{ background:"rgba(239,68,68,0.06)", borderColor:"rgba(239,68,68,0.2)" }}>
            <p className="text-sm font-medium mb-3" style={{ color:"var(--danger)" }}>{err}</p>
            <button onClick={()=>window.location.reload()}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ background:"var(--danger)" }}>
              Coba Lagi
            </button>
          </div>
        )}

        {!loading && !err && (
          <>
            {/* ── Greeting + CTA ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {/* Micro-text di atas — konteks sesi + waktu, bikin terasa personal */}
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color:"var(--text3)" }}>
                  {profile?.sessions_count
                    ? `Sesi ke-${profile.sessions_count + 1} · Selamat ${timeGreet}`
                    : `Selamat ${timeGreet} · Mulai perjalananmu`}
                </p>
                <h1 className="text-3xl font-bold tracking-tight" style={{ color:"var(--text)" }}>
                  Hai, <span style={{ color:"var(--accent)" }}>{username}</span>
                </h1>
                <p className="text-sm mt-1.5" style={{ color:"var(--text3)" }}>
                  {profile?.sessions_count
                    ? `Level ${profile.level} · Target ${profile.target_cefr}`
                    : "Selesaikan sesi pertama untuk melihat progresmu."}
                </p>
              </div>
              <Link href="/practice/agent"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
                style={{ background:"var(--accent)" }}>
                <Icon.Bolt width={14} height={14} style={{ stroke:"#0c0c10" }} />
                <span style={{ color:"#0c0c10" }}>Latihan AI</span>
              </Link>
            </div>

            {/* ── CEFR level banner ── */}
            <div className="rounded-2xl p-6 border" style={{ ...card, borderColor:"var(--accent-border)", background:"var(--accent-dim)" }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color:"var(--accent)" }}>
                    Level CEFR
                  </p>
                  {/* Angka 64px — lebih dramatic, jadi focal point banner */}
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-black leading-none" style={{ fontSize:64, color:"var(--accent)", lineHeight:1 }}>
                      {cefrKey(overall)}
                    </span>
                    <span className="text-lg font-medium" style={{ color:"var(--text2)" }}>{overall.toFixed(1)}/5</span>
                  </div>
                  {/* Deskripsi 1 kalimat — bikin angka punya konteks emosional */}
                  <p className="text-xs leading-relaxed" style={{ color:"var(--accent)", opacity:0.75 }}>
                    {CEFR_DESC[cefrKey(overall)]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs mb-1" style={{ color:"var(--text3)" }}>Target</p>
                  <p className="text-2xl font-bold" style={{ color:"var(--text2)" }}>{profile?.target_cefr ?? "B1"}</p>
                </div>
              </div>
              {/* Level track */}
              <div className="mt-5">
                <div className="flex justify-between text-xs mb-2" style={{ color:"var(--text3)" }}>
                  {["A1","A2","B1","B2","C1+"].map(l=><span key={l}>{l}</span>)}
                </div>
                <div className="h-2 rounded-full" style={{ background:"var(--border2)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width:`${toP(overall)}%`, background:"var(--accent)" }} />
                </div>
                {/* Level dots */}
                <div className="flex gap-1.5 mt-3">
                  {[1,2,3,4,5].map(l => (
                    <div key={l} className="h-1.5 flex-1 rounded-full transition-all"
                      style={{ background: l<=(profile?.level??0) ? "var(--accent)" : "var(--border2)" }} />
                  ))}
                </div>
                <p className="text-xs mt-1" style={{ color:"var(--text3)" }}>Level {profile?.level ?? 1} dari 5</p>
              </div>
            </div>

            {/* ── Stats — hero kiri + 2 kecil kanan (sama pola dengan admin) ── */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Hero: Total Sesi — ukuran besar karena menunjukkan konsistensi latihan */}
              <div className="sm:flex-[2] rounded-2xl px-7 py-6" style={card}>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color:"var(--text3)" }}>
                  Total Sesi Latihan
                </p>
                <p className="font-black leading-none tabular-nums" style={{ fontSize:64, color:"var(--text)", lineHeight:1 }}>
                  {profile?.sessions_count ?? 0}
                </p>
                <p className="text-xs mt-3" style={{ color:"var(--text3)" }}>sesi diselesaikan</p>
              </div>
              {/* 2 kecil stacked */}
              <div className="sm:flex-1 flex flex-row sm:flex-col gap-3">
                <div className="flex-1 rounded-2xl px-4 py-3 flex items-center justify-between gap-4" style={card}>
                  <p className="text-[11px] font-medium uppercase tracking-wider leading-tight" style={{ color:"var(--text3)" }}>Waktu Latihan</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color:"var(--text)", lineHeight:1 }}>
                    {(stats?.total_hours??0).toFixed(1)}<span className="text-sm font-normal ml-0.5" style={{ color:"var(--text3)" }}>j</span>
                  </p>
                </div>
                <div className="flex-1 rounded-2xl px-4 py-3 flex items-center justify-between gap-4" style={card}>
                  <p className="text-[11px] font-medium uppercase tracking-wider leading-tight" style={{ color:"var(--text3)" }}>Skor Rata-rata</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color:"var(--accent)", lineHeight:1 }}>
                    {overall.toFixed(1)}<span className="text-sm font-normal ml-0.5" style={{ color:"var(--text3)" }}>/5</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ── CEFR profile + tip ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Bars */}
              <div className="lg:col-span-3 rounded-2xl p-6" style={card}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color:"var(--text3)" }}>Profil kemampuan</p>
                {profile ? (
                  <div>
                    {(["range","accuracy","fluency","coherence","phonology"] as const).map((d, idx) => {
                      const v = profile.ma[d];
                      const col = scoreCol(v);
                      const isWeak = d === weakDim;
                      return (
                        <div key={d} className={idx > 0 ? "pt-4" : ""}>
                          {/* Gradient separator — fade dari kiri, hilang di kanan */}
                          {idx > 0 && (
                            <div className="mb-4 h-px" style={{
                              background:"linear-gradient(90deg, var(--border2) 0%, transparent 75%)",
                            }} />
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm" style={{ color:"var(--text2)" }}>{DIM[d]}</span>
                              {isWeak && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                                  style={{ color:"var(--warn)", background:"rgba(245,158,11,0.08)", borderColor:"rgba(245,158,11,0.25)" }}>
                                  perlu latihan
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold tabular-nums" style={{ color:col }}>{v.toFixed(1)}</span>
                              <span className="text-[11px] font-semibold w-7 text-right" style={{ color:"var(--text3)" }}>{cefrKey(v)}</span>
                            </div>
                          </div>
                          {/* Bar h-2 — lebih berbobot dari h-1.5 */}
                          <div className="h-2 rounded-full" style={{ background:"var(--border2)" }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width:`${toP(v)}%`, background: isWeak ? "var(--warn)" : col }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color:"var(--text3)" }}>Selesaikan sesi pertama untuk melihat profil.</p>
                )}
              </div>

              {/* Tip + quick level */}
              <div className="lg:col-span-2 flex flex-col gap-3">
                {weakDim ? (
                  <div className="flex-1 rounded-2xl p-6 border"
                    style={{ background:"rgba(245,158,11,0.05)", borderColor:"rgba(245,158,11,0.2)" }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:"var(--warn)" }}>Rekomendasi</p>
                    <p className="font-semibold mb-2" style={{ color:"var(--text)" }}>{DIM[weakDim]}</p>
                    <p className="text-sm leading-relaxed mb-4" style={{ color:"var(--text2)" }}>{TIPS[weakDim]}</p>
                    <Link href="/practice/agent"
                      className="flex items-center justify-between px-4 py-3 rounded-xl border transition-all group hover:opacity-90"
                      style={{ background:"rgba(245,158,11,0.08)", borderColor:"rgba(245,158,11,0.25)", color:"var(--warn)" }}>
                      <span className="text-sm font-medium">Latihan fokus</span>
                      <Icon.Arrow width={14} height={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                ) : (
                  <div className="flex-1 rounded-2xl p-6 flex items-center justify-center" style={card}>
                    <p className="text-sm text-center" style={{ color:"var(--text3)" }}>
                      Selesaikan sesi untuk melihat rekomendasi.
                    </p>
                  </div>
                )}
                <div className="rounded-2xl p-5" style={card}>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color:"var(--text3)" }}>Menit latihan</p>
                  <p className="text-3xl font-bold" style={{ color:"var(--text)" }}>
                    {Math.round(stats?.total_minutes??0)}
                    <span className="text-base font-normal ml-1" style={{ color:"var(--text3)" }}>mnt</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ── History ── */}
            <div className="rounded-2xl overflow-hidden" style={card}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor:"var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>Riwayat latihan</p>
                <span className="text-xs" style={{ color:"var(--text3)" }}>{sessions.length} sesi</span>
              </div>
              {sessions.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-sm mb-4" style={{ color:"var(--text3)" }}>Belum ada sesi latihan.</p>
                  <Link href="/practice"
                    className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                    style={{ color:"var(--accent)" }}>
                    Mulai latihan pertama <Icon.Arrow width={12} height={12} />
                  </Link>
                </div>
              ) : (
                <div>
                  {sessions.map(s => {
                    const col  = scoreCol(s.score_overall);
                    const date = new Date(s.created_at);
                    return (
                      <div key={s.id}
                        className="flex items-center gap-4 px-6 py-4 border-b last:border-0 transition-colors"
                        style={{ borderColor:"var(--border)" }}
                        onMouseEnter={e=>(e.currentTarget.style.background="var(--surface2)")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ background:`${col}14`, color:col }}>
                          {s.score_overall.toFixed(1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color:"var(--text)" }}>{s.scenario}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-20 h-1.5 rounded-full" style={{ background:"var(--border2)" }}>
                              <div className="h-full rounded-full" style={{ width:`${toP(s.score_overall)}%`, background:col }} />
                            </div>
                            <span className="text-xs font-medium" style={{ color:col }}>{cefrKey(s.score_overall)}</span>
                          </div>
                        </div>
                        <span className="text-xs whitespace-nowrap flex-shrink-0" style={{ color:"var(--text3)" }}>
                          {isNaN(date.getTime()) ? "—" : fmt.format(date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}