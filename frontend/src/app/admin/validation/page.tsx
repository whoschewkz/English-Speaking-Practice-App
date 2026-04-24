"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch, TokenStore } from "@/utils/auth";
import { NavBar, Icon, useTheme } from "@/components/shared";

type Session = {
  id: number;
  scenario: string;
  audio_path: string | null;
  duration_min: number;
  created_at: string;
  ai_scores: Record<string, number>;
  rater_scores: Record<number, Record<string, number>>;
  rating_status: { rater_1_done: boolean; rater_2_done: boolean; both_done: boolean };
};

type Correlation = {
  r: number;
  p_value: number;
  n: number;
};

const DIMENSIONS = [
  { key: "range", label: "Kosakata" },
  { key: "accuracy", label: "Tata Bahasa" },
  { key: "fluency", label: "Kelancaran" },
  { key: "coherence", label: "Koherensi" },
  { key: "phonology", label: "Pelafalan" },
];

export default function ValidationPage() {
  const API = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
  const { dark } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [rater, setRater] = useState<1 | 2>(1);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [correlations, setCorrelations] = useState<any>(null);
  const [showCorr, setShowCorr] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!TokenStore.isLoggedIn()) {
      window.location.href = "/auth";
      return;
    }
    if (TokenStore.getRole() !== "admin") {
      window.location.href = "/dashboard";
      return;
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    loadSessions();
  }, [mounted]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const r = await authFetch(`${API}/api/admin/validation/sessions`);
      if (!r.ok) throw new Error("Gagal memuat sessions");
      const data = await r.json();
      setSessions(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCorrelations = async () => {
    try {
      const r = await authFetch(`${API}/api/admin/validation/correlations`);
      if (!r.ok) throw new Error("Gagal memuat correlations");
      const data = await r.json();
      setCorrelations(data);
      setShowCorr(true);
    } catch (e: any) {
      console.error(e);
    }
  };

  const selectSession = (s: Session) => {
    setSelectedSession(s);
    setScores({});
    setNotes("");
    // Pre-fill dengan existing scores jika ada
    if (s.rater_scores[rater]) {
      const existing = s.rater_scores[rater];
      const prefilled: Record<string, number> = {};
      for (const d of DIMENSIONS) {
        if (existing[d.key] !== null) {
          prefilled[d.key] = existing[d.key];
        }
      }
      setScores(prefilled);
    }
  };

  const saveScore = async () => {
    if (!selectedSession) return;
    try {
      setSaving(true);
      const payload = {
        session_id: selectedSession.id,
        rater_id: rater,
        score_range: scores.range || null,
        score_accuracy: scores.accuracy || null,
        score_fluency: scores.fluency || null,
        score_coherence: scores.coherence || null,
        score_phonology: scores.phonology || null,
        notes: notes || null,
      };
      const r = await authFetch(`${API}/api/admin/validation/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Gagal menyimpan score");
      setSelectedSession(null);
      loadSessions();
    } catch (e: any) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "20px" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <NavBar
        links={[
          { label: "Latihan", href: "/practice" },
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin", active: true },
        ]}
      />

      <main className="max-w-7xl mx-auto px-5 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--text)" }}>
            Penilaian Rater (Validasi AI)
          </h1>
          <p style={{ color: "var(--text2)" }}>
            Dengarkan session dan beri skor untuk validasi akurasi AI scoring.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Sessions list */}
          <div className="rounded-[20px] overflow-hidden" style={card}>
            <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase" style={{ color: "var(--text3)" }}>
                Daftar Session ({sessions.length})
              </p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSession(s)}
                  className="w-full text-left px-4 py-3 border-b transition-colors"
                  style={{
                    borderColor: "var(--border)",
                    background: selectedSession?.id === s.id ? "var(--surface2)" : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = selectedSession?.id !== s.id ? "var(--surface2)" : "")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = selectedSession?.id !== s.id ? "transparent" : "")
                  }
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                      {s.scenario}
                    </p>
                    <span className="text-xs" style={{ color: "var(--text3)" }}>
                      #{s.id}
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--text2)" }}>
                    {new Date(s.created_at).toLocaleDateString("id-ID")}
                  </p>
                  <div className="flex gap-1">
                    {s.rating_status.rater_1_done && (
                      <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--accent)", color: "#0c0c10" }}>
                        R1 ✓
                      </span>
                    )}
                    {s.rating_status.rater_2_done && (
                      <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--warn)", color: "#0c0c10" }}>
                        R2 ✓
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Middle: Audio + Score form */}
          {selectedSession ? (
            <div className="lg:col-span-2 space-y-6">
              {/* Audio Player */}
              <div className="rounded-[20px] overflow-hidden" style={card}>
                <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold uppercase" style={{ color: "var(--text3)" }}>
                    Audio Session
                  </p>
                </div>
                <div className="p-6">
                  {selectedSession.audio_path ? (
                    <audio
                      controls
                      className="w-full mb-4"
                      style={{ borderRadius: "12px" }}
                    >
                      <source src={`${API}/uploads/audio/${selectedSession.audio_path}`} type="audio/wav" />
                      Browser Anda tidak support audio playback
                    </audio>
                  ) : (
                    <p style={{ color: "var(--danger)" }}>Audio tidak tersedia</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p style={{ color: "var(--text3)" }}>Durasi</p>
                      <p className="font-semibold" style={{ color: "var(--text)" }}>
                        {selectedSession.duration_min.toFixed(1)} menit
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "var(--text3)" }}>Skenario</p>
                      <p className="font-semibold" style={{ color: "var(--text)" }}>
                        {selectedSession.scenario}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Scores Reference */}
              <div className="rounded-[20px] overflow-hidden" style={card}>
                <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold uppercase" style={{ color: "var(--text3)" }}>
                    AI Scores (Referensi)
                  </p>
                </div>
                <div className="p-6 grid grid-cols-5 gap-3">
                  {DIMENSIONS.map((d) => (
                    <div key={d.key} className="text-center">
                      <p className="text-xs mb-1" style={{ color: "var(--text3)" }}>
                        {d.label}
                      </p>
                      <p className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                        {selectedSession.ai_scores[d.key]?.toFixed(1)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Form */}
              <div className="rounded-[20px] overflow-hidden" style={card}>
                <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase" style={{ color: "var(--text3)" }}>
                      Penilaian Rater
                    </p>
                    <select
                      value={rater}
                      onChange={(e) => setRater(parseInt(e.target.value) as 1 | 2)}
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    >
                      <option value="1">Rater 1</option>
                      <option value="2">Rater 2</option>
                    </select>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {DIMENSIONS.map((d) => (
                    <div key={d.key}>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium" style={{ color: "var(--text)" }}>
                          {d.label}
                        </label>
                        <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                          {scores[d.key]?.toFixed(1) || "-"} / 5
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.5"
                        value={scores[d.key] || 3}
                        onChange={(e) => setScores({ ...scores, [d.key]: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="text-sm font-medium block mb-2" style={{ color: "var(--text)" }}>
                      Catatan (opsional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                      rows={3}
                      placeholder="Tulis catatan atau observasi..."
                    />
                  </div>

                  <button
                    onClick={saveScore}
                    disabled={saving}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                    style={{ background: saving ? "var(--text3)" : "var(--accent)", color: "#0c0c10" }}
                  >
                    {saving ? "Menyimpan..." : "Simpan Penilaian"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 rounded-[20px] p-10 text-center" style={card}>
              <p style={{ color: "var(--text2)" }}>Pilih session untuk mulai menilai</p>
            </div>
          )}
        </div>

        {/* Correlation Dashboard */}
        <div className="mt-10">
          <button
            onClick={loadCorrelations}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white mb-6"
            style={{ background: "var(--accent)", color: "#0c0c10" }}
          >
            Hitung Korelasi
          </button>

          {correlations && (
            <div className="rounded-[20px] overflow-hidden" style={card}>
              <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase" style={{ color: "var(--text3)" }}>
                  Analisis Korelasi (n={correlations.sample_size})
                </p>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {["ai_vs_rater1", "ai_vs_rater2", "rater1_vs_rater2"].map((key) => (
                    <div key={key} className="p-4 rounded-lg" style={{ background: "var(--surface2)" }}>
                      <p className="text-xs font-semibold mb-3" style={{ color: "var(--text3)" }}>
                        {key === "ai_vs_rater1"
                          ? "AI vs Rater 1"
                          : key === "ai_vs_rater2"
                            ? "AI vs Rater 2"
                            : "Rater 1 vs Rater 2"}
                      </p>
                      <div className="space-y-2 text-xs">
                        {DIMENSIONS.map((d) => {
                          const data = correlations[key][d.key];
                          if (!data) return null;
                          return (
                            <div key={d.key} className="flex justify-between">
                              <span>{d.label}:</span>
                              <span style={{ color: data.r > 0.7 ? "var(--accent)" : data.r > 0.5 ? "var(--warn)" : "var(--danger)" }}>
                                {data.r.toFixed(3)}
                              </span>
                            </div>
                          );
                        })}
                        {correlations[key]["overall"] && (
                          <div className="border-t pt-2 font-bold" style={{ borderColor: "var(--border)" }}>
                            <div className="flex justify-between">
                              <span>Overall:</span>
                              <span style={{ color: "var(--accent)" }}>
                                {correlations[key]["overall"].r.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
