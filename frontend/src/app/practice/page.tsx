"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch, TokenStore } from "@/utils/auth";
import { NavBar, Icon, useTheme } from "@/components/shared";

type Scenario   = { id: number; title: string; description?: string | null };
type SessionRow = { id: number; scenario: string; score_overall: number; created_at: string };

const SC_ACCENT: Record<number, string> = { 1:"#818cf8", 2:"#00c896", 3:"#60a5fa", 4:"#f472b6" };
const SC_TAG:    Record<number, string> = { 1:"Karier", 2:"Sosial", 3:"Profesional", 4:"Perjalanan" };

function cefrKey(s: number) {
  if (s>=4.5) return "C1+"; if (s>=3.5) return "B2"; if (s>=2.5) return "B1"; if (s>=1.5) return "A2"; return "A1";
}
function toP(s: number) { return Math.max(0,Math.min(100,((s-1)/4)*100)); }
function scoreCol(s: number) {
  return s>=3.5 ? "var(--accent)" : s>=2.5 ? "var(--warn)" : "var(--danger)";
}

export default function PracticePage() {
  const API = (process.env.NEXT_PUBLIC_API_BASE_URL||"http://localhost:8000").replace(/\/+$/,"");
  const { dark } = useTheme();

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [recent,    setRecent]    = useState<SessionRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string|null>(null);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!TokenStore.isLoggedIn()) { window.location.href="/auth"; return; }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const ctrl = new AbortController();
    (async () => {
      setLoading(true); setErr(null);
      try {
        const [s1,s2] = await Promise.all([
          authFetch(`${API}/api/scenarios`),
          authFetch(`${API}/api/sessions/recent?limit=5`),
        ]);
        if (!s1.ok||!s2.ok) throw new Error("Gagal memuat data.");
        setScenarios(await s1.json());
        setRecent(await s2.json());
      } catch(e:any) { if(e?.name!=="AbortError") setErr(e?.message||"Gagal."); }
      finally { setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [mounted, API]);

  const fmt = useMemo(() => new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short"}), []);
  if (!mounted) return <div style={{ minHeight:"100vh", background:"var(--bg)" }} />;

  const card = { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"20px" };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <NavBar
        links={[
          { label:"Latihan",   href:"/practice",  active:true },
          { label:"Dashboard", href:"/dashboard" },
        ]}
      />

      <main className="max-w-6xl mx-auto px-5 py-10">
        {/* ── Hero ── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:"var(--accent)" }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--accent)" }}>
              Unit Bahasa · Platform Aktif
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none mb-3" style={{ color:"var(--text)" }}>
            Latihan berbicara<br />
            <span style={{ color:"var(--accent)" }}>bahasa Inggris.</span>
          </h1>
          {/* Tagline — italic ringan, soul kecil yang membedakan dari platform generik */}
          <p className="text-sm italic mb-5" style={{ color:"var(--text3)", fontWeight:300 }}>
            Untuk mahasiswa Unit Bahasa Poltek SSN — latih, ukur, berkembang.
          </p>
          <p className="text-lg max-w-xl leading-relaxed mb-7" style={{ color:"var(--text2)" }}>
            Pilih skenario atau biarkan AI memilihkan latihan terbaik berdasarkan progresmu.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/practice/agent"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 hover:opacity-90"
              style={{ background:"var(--accent)", color:"#0c0c10" }}>
              <Icon.Bolt width={14} height={14} />
              Mulai dengan AI
            </Link>
            <a href="#scenarios"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-medium border transition-all hover:opacity-80"
              style={{ color:"var(--text2)", borderColor:"var(--border2)", background:"var(--surface)" }}>
              Lihat skenario
              <Icon.Arrow width={14} height={14} />
            </a>
          </div>
        </div>

        {/* ── Error ── */}
        {err && (
          <div className="mb-8 flex items-center gap-3 rounded-2xl px-5 py-4 border"
            style={{ background:"rgba(239,68,68,0.06)", borderColor:"rgba(239,68,68,0.2)", color:"var(--danger)" }}>
            <p className="text-sm flex-1">{err}</p>
            <button onClick={()=>window.location.reload()}
              className="text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background:"var(--danger)" }}>
              Refresh
            </button>
          </div>
        )}

        {/* ── Scenarios ── */}
        <section id="scenarios" className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>Pilih skenario</p>
            {!loading && <span className="text-xs" style={{ color:"var(--text3)" }}>{scenarios.length} tersedia</span>}
          </div>

          {loading ? (
            /* Skeleton — 2-col asymmetric sama dengan layout akhir */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-64 rounded-[20px] animate-pulse" style={{ background:"var(--surface)", border:"1px solid var(--border)" }} />
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_,i) => (
                  <div key={i} className="h-[72px] rounded-[16px] animate-pulse" style={{ background:"var(--surface)", border:"1px solid var(--border)" }} />
                ))}
              </div>
            </div>
          ) : (
            /* 2-col: AI Plan (kiri, tinggi penuh) + scenario cards compact (kanan, stacked) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

              {/* AI Plan — kiri, generous whitespace karena sendiri di kolom */}
              <Link href="/practice/agent"
                className="group rounded-[20px] p-8 block border transition-all hover:opacity-95 h-full"
                style={{ background:"var(--accent-dim)", borderColor:"var(--accent-border)" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--accent)")}
                onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--accent-border)")}>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background:"var(--accent)" }}>
                    <Icon.Bolt width={22} height={22} style={{ color:"white", opacity:.2 }} />
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background:"var(--accent)", color:"#0c0c10" }}>AI</span>
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color:"var(--text)" }}>My Plan — AI Mode</h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color:"var(--text2)" }}>
                  AI menganalisis progresmu dan memilihkan skenario + latihan yang paling dibutuhkan secara otomatis.
                </p>
                <div className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all"
                  style={{ color:"var(--accent)" }}>
                  Mulai sekarang <Icon.Arrow width={14} height={14} />
                </div>
              </Link>

              {/* Kanan: scenario cards compact stacked — lebih editorial, tidak bersaing dengan AI card */}
              <div className="flex flex-col gap-3">
                {scenarios.length === 0 ? (
                  <div className="py-14 text-center text-sm" style={{ color:"var(--text3)" }}>
                    Belum ada skenario. Hubungi admin Unit Bahasa.
                  </div>
                ) : scenarios.map(s => {
                  const accent = SC_ACCENT[s.id] || "var(--accent)";
                  const tag    = SC_TAG[s.id]    || "Umum";
                  return (
                    <Link key={s.id} href={`/practice/${s.id}`}
                      className="group block rounded-[16px] px-5 py-4 border transition-all"
                      style={{ ...card }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=`${accent}50`; e.currentTarget.style.background="var(--surface2)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.background="var(--surface)"; }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 border"
                            style={{ color:accent, background:`${accent}12`, borderColor:`${accent}30` }}>
                            {tag}
                          </span>
                          <h3 className="text-sm font-semibold truncate" style={{ color:"var(--text)" }}>{s.title}</h3>
                        </div>
                        <Icon.Arrow width={12} height={12} className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color:accent }} />
                      </div>
                      {s.description && (
                        <p className="text-xs mt-1.5 line-clamp-1 pl-[calc(theme(spacing.2)+theme(spacing.3)+2rem)]" style={{ color:"var(--text3)" }}>
                          {s.description}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Recent sessions ── */}
        {(loading || recent.length>0) && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--text3)" }}>Latihan terakhir</p>
              <Link href="/dashboard"
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color:"var(--accent)" }}
                onMouseEnter={e=>(e.currentTarget.style.opacity="0.7")}
                onMouseLeave={e=>(e.currentTarget.style.opacity="1")}>
                Lihat semua <Icon.Arrow width={10} height={10} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_,i) => (
                  <div key={i} className="h-16 rounded-2xl animate-pulse"
                    style={{ background:"var(--surface)", border:"1px solid var(--border)" }} />
                ))}
              </div>
            ) : (
              /* Timeline asimetris: tanggal di kiri, dot penanda, latest dibedakan */
              <div className="rounded-[20px] overflow-hidden" style={card}>
                {recent.map((r, idx) => {
                  const col      = scoreCol(r.score_overall);
                  const d        = new Date(r.created_at);
                  const isLatest = idx === 0;
                  return (
                    <div key={r.id}
                      className="flex items-center gap-0 border-b last:border-0 transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        background: isLatest ? "var(--surface2)" : "transparent",
                      }}
                      onMouseEnter={e=>(e.currentTarget.style.background="var(--surface2)")}
                      onMouseLeave={e=>(e.currentTarget.style.background= isLatest ? "var(--surface2)" : "transparent")}>

                      {/* Kolom tanggal — KIRI (asimetris vs posisi kanan sebelumnya) */}
                      <div className="w-16 flex-shrink-0 px-4 py-4 text-right">
                        <span className="text-[10px] tabular-nums leading-tight block" style={{ color:"var(--text3)" }}>
                          {isNaN(d.getTime()) ? "—" : fmt.format(d)}
                        </span>
                        {isLatest && (
                          <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color:"var(--accent)" }}>
                            baru
                          </span>
                        )}
                      </div>

                      {/* Dot timeline */}
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: isLatest ? col : "var(--border2)" }} />

                      {/* Konten */}
                      <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color:"var(--text)", fontWeight: isLatest ? 600 : 500 }}>
                            {r.scenario}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-20 h-1.5 rounded-full" style={{ background:"var(--border2)" }}>
                              <div className="h-full rounded-full" style={{ width:`${toP(r.score_overall)}%`, background:col }} />
                            </div>
                            <span className="text-xs font-semibold tabular-nums" style={{ color:col }}>
                              {r.score_overall.toFixed(1)} · {cefrKey(r.score_overall)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}