"use client";
import { useEffect, useState } from "react";
import { authFetch, TokenStore } from "@/utils/auth";
import { useTheme, Icon } from "@/components/shared";

type RaterSession = {
  id: number;
  scenario: string;
  audio_path: string | null;
  duration_min: number;
  created_at: string;
  my_rater_id:    number;   // 1 atau 2, dari role login
  my_rating_done: boolean;  // apakah SAYA sudah menilai sesi ini
};

const DIMS = [
  { key: "range",     label: "Kosakata" },
  { key: "accuracy",  label: "Tata Bahasa" },
  { key: "fluency",   label: "Kelancaran" },
  { key: "coherence", label: "Koherensi" },
  { key: "phonology", label: "Pelafalan" },
];

export default function RaterPage() {
  const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
  const { dark, toggle } = useTheme();

  const [mounted,   setMounted]   = useState(false);
  const [username,  setUsername]  = useState("");
  const [myRaterNum,setMyRaterNum]= useState<1|2>(1);  // dari role, bukan pilihan user
  const [sessions,  setSessions]  = useState<RaterSession[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<RaterSession | null>(null);
  const [scores,    setScores]    = useState<Record<string, number>>({});
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [success,   setSuccess]   = useState<string | null>(null);
  const [err,       setErr]       = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!TokenStore.isLoggedIn()) { window.location.href = "/auth"; return; }
    const role = TokenStore.getRole();
    if (role !== "rater1" && role !== "rater2") { window.location.href = "/auth"; return; }
    setMyRaterNum(role === "rater1" ? 1 : 2);
    setUsername(TokenStore.getUsername() || "rater");
  }, []);

  useEffect(() => { if (mounted) loadSessions(); }, [mounted]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/api/rater/sessions`);
      if (!r.ok) throw new Error(`${r.status}`);
      setSessions(await r.json());
    } catch (e: any) { setErr(e?.message); }
    finally { setLoading(false); }
  };

  const selectSession = (s: RaterSession) => {
    setSelected(s);
    setScores({});
    setNotes("");
    setErr(null);
  };

  const saveScore = async () => {
    if (!selected) return;
    const missing = DIMS.filter(d => scores[d.key] == null);
    if (missing.length) { setErr(`Isi semua dimensi: ${missing.map(d => d.label).join(", ")}`); return; }
    setSaving(true);
    try {
      // rater_id di-ignore backend (diambil dari role JWT), tapi tetap kirim untuk compat schema
      const r = await authFetch(`${API}/api/rater/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id:      selected.id,
          rater_id:        myRaterNum,
          score_range:     scores.range,
          score_accuracy:  scores.accuracy,
          score_fluency:   scores.fluency,
          score_coherence: scores.coherence,
          score_phonology: scores.phonology,
          notes:           notes || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setSuccess("Penilaian disimpan!");
      setTimeout(() => setSuccess(null), 3000);
      setSelected(null);
      loadSessions();
    } catch (e: any) { setErr(e?.message); }
    finally { setSaving(false); }
  };

  const logout = async () => {
    const { logout: lo } = await import("@/utils/auth");
    lo();
  };

  if (!mounted) return <div style={{ minHeight: "100vh", background: "var(--bg)" }} />;

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px" };
  const doneSessions    = sessions.filter(s => s.my_rating_done).length;
  const pendingSessions = sessions.length - doneSessions;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b"
        style={{ background: dark ? "rgba(12,12,16,0.92)" : "rgba(246,246,248,0.92)", borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
              <Icon.Mic width={13} height={13} style={{ stroke: "#0c0c10" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>BicarAI</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.3)" }}>
              Rater {myRaterNum}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface2)", color: "var(--text2)" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}>
                {username[0]?.toUpperCase()}
              </div>
              <span>{username}</span>
            </div>
            <button onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ color: "var(--text3)" }}>
              {dark ? <Icon.Sun width={15} height={15} /> : <Icon.Moon width={15} height={15} />}
            </button>
            <button onClick={logout}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{ color: "var(--text3)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "transparent"; }}>
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>Penilaian Sesi</h1>
          <p className="text-sm" style={{ color: "var(--text3)" }}>
            Dengarkan rekaman audio dan beri skor per dimensi. Skor AI <strong>tidak ditampilkan</strong> untuk menjaga independensi penilaian.
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Sesi",          value: sessions.length },
            { label: "Belum Saya Nilai",    value: pendingSessions },
            { label: `Sudah Saya Nilai (R${myRaterNum})`, value: doneSessions },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={card}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text3)" }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Flash ── */}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-2xl border text-sm"
            style={{ background: "rgba(0,200,150,0.08)", borderColor: "rgba(0,200,150,0.25)", color: "var(--accent)" }}>
            {success}
          </div>
        )}
        {err && (
          <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-2xl border text-sm"
            style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.2)", color: "var(--danger)" }}>
            <span>{err}</span>
            <button onClick={() => setErr(null)} className="ml-4 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Sessions list */}
          <div className="rounded-3xl overflow-hidden" style={card}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text3)" }}>
                Sesi Tersedia
              </p>
              <button onClick={loadSessions} disabled={loading}
                className="text-xs px-3 py-1 rounded-xl border disabled:opacity-40"
                style={{ color: "var(--text2)", borderColor: "var(--border2)", background: "var(--surface2)" }}>
                {loading ? "…" : "Refresh"}
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              {loading ? (
                <div className="flex items-center justify-center h-32 gap-2" style={{ color: "var(--text3)" }}>
                  <Icon.Spinner width={16} height={16} />
                  <span className="text-sm">Memuat…</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text3)" }}>
                  Belum ada sesi dengan rekaman audio
                </div>
              ) : sessions.map(s => (
                <button key={s.id} onClick={() => selectSession(s)}
                  className="w-full text-left px-5 py-4 border-b transition-colors"
                  style={{
                    borderColor: "var(--border)",
                    background: selected?.id === s.id ? "var(--accent-dim)" : "transparent",
                  }}
                  onMouseEnter={e => { if (selected?.id !== s.id) e.currentTarget.style.background = "var(--surface2)"; }}
                  onMouseLeave={e => { if (selected?.id !== s.id) e.currentTarget.style.background = "transparent"; }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{s.scenario}</p>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: "var(--text3)" }}>#{s.id}</span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--text2)" }}>
                    {new Date(s.created_at).toLocaleDateString("id-ID")} · {s.duration_min.toFixed(1)} min
                  </p>
                  {/* Hanya tampilkan status penilaian SENDIRI — tidak tahu status rater lain */}
                  <div className="flex gap-1.5">
                    {s.my_rating_done ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                        R{s.my_rater_id} ✓ Sudah dinilai
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>
                        Belum dinilai
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Scoring panel */}
          {selected ? (
            <div className="lg:col-span-2 space-y-4">

              {/* Audio player */}
              <div className="rounded-3xl p-6" style={card}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text3)" }}>
                  Rekaman Audio — {selected.scenario}
                </p>
                {selected.audio_path ? (
                  <audio key={selected.id} controls className="w-full" style={{ borderRadius: 12 }}>
                    <source src={`${API}/uploads/audio/${selected.audio_path}`} type="audio/wav" />
                    Browser tidak support audio
                  </audio>
                ) : (
                  <p className="text-sm" style={{ color: "var(--danger)" }}>Audio tidak tersedia</p>
                )}
                <div className="grid grid-cols-3 gap-4 mt-4 text-xs">
                  <div>
                    <p style={{ color: "var(--text3)" }}>Durasi</p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{selected.duration_min.toFixed(1)} menit</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text3)" }}>Tanggal</p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{new Date(selected.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text3)" }}>Sesi ID</p>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>#{selected.id}</p>
                  </div>
                </div>
              </div>

              {/* Notice: AI scores hidden */}
              <div className="rounded-2xl px-5 py-3 flex items-center gap-3 text-sm"
                style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.2)", color: "#818cf8" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                </svg>
                <span>Skor AI tidak ditampilkan untuk menjaga independensi penilaian rater.</span>
              </div>

              {/* Scoring form */}
              <div className="rounded-3xl p-6" style={card}>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text3)" }}>
                    Form Penilaian
                  </p>
                  {/* Rater ID otomatis dari login — tidak bisa dipilih */}
                  <div className="flex gap-2">
                    <span className="px-4 py-1.5 rounded-xl text-xs font-bold border"
                      style={{ color:"#0c0c10", background:"var(--accent)", borderColor:"var(--accent)" }}>
                      Rater {myRaterNum}{selected.my_rating_done ? " ✓" : ""}
                    </span>
                  </div>
                </div>

                <div className="space-y-5">
                  {DIMS.map(d => (
                    <div key={d.key}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium" style={{ color: "var(--text)" }}>{d.label}</label>
                        <span className="text-sm font-bold" style={{ color: scores[d.key] ? "var(--accent)" : "var(--text3)" }}>
                          {scores[d.key]?.toFixed(1) ?? "—"} / 5
                        </span>
                      </div>
                      <input type="range" min="1" max="5" step="0.5"
                        value={scores[d.key] ?? 3}
                        onChange={e => setScores(p => ({ ...p, [d.key]: parseFloat(e.target.value) }))}
                        className="w-full" />
                      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "var(--text3)" }}>
                        <span>1 — Lemah</span><span>3 — Cukup</span><span>5 — Sangat Baik</span>
                      </div>
                    </div>
                  ))}

                  <div>
                    <label className="text-sm font-medium block mb-2" style={{ color: "var(--text)" }}>
                      Catatan (opsional)
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      rows={2} placeholder="Observasi atau komentar…"
                      className="w-full px-3 py-2 rounded-xl text-sm"
                      style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", outline: "none", resize: "vertical" }} />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setSelected(null)}
                      className="px-5 py-2.5 rounded-2xl text-sm font-medium border transition-all"
                      style={{ color: "var(--text2)", borderColor: "var(--border2)", background: "var(--surface2)" }}>
                      Batal
                    </button>
                    <button onClick={saveScore} disabled={saving}
                      className="flex-1 py-2.5 rounded-2xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "#0c0c10" }}>
                      {saving ? "Menyimpan…" : "Simpan Penilaian"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 rounded-3xl p-10 flex flex-col items-center justify-center" style={card}>
              <p className="text-4xl mb-3">🎧</p>
              <p className="font-medium text-sm" style={{ color: "var(--text2)" }}>Pilih sesi untuk mulai menilai</p>
              <p className="text-xs mt-1" style={{ color: "var(--text3)" }}>Dengarkan audio, lalu beri skor per dimensi CEFR</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
