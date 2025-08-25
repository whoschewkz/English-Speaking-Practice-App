"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Profile = {
  user_id: number;
  level: number;
  target_cefr: string;
  sessions_count: number;
  ma: {
    pronunciation: number;
    grammar: number;
    fluency: number;
    vocabulary: number;
    overall: number;
  };
};

type RecentSession = {
  id: number;
  scenario: string;
  score_overall: number;
  created_at: string; // ISO
};

type Stats = {
  total_minutes: number;
  total_hours: number;
  sessions_count: number;
};

export default function DashboardPage() {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const [pRes, rRes, sRes] = await Promise.all([
          fetch(`${API_BASE}/api/profile`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/sessions/recent?limit=10`, { cache: "no-store" }),
          fetch(`${API_BASE}/api/sessions/stats`, { cache: "no-store" }),
        ]);

        if (!pRes.ok) throw new Error(await pRes.text());
        if (!rRes.ok) throw new Error(await rRes.text());
        if (!sRes.ok) throw new Error(await sRes.text());

        const pJson = (await pRes.json()) as Profile;
        const rJson = (await rRes.json()) as RecentSession[];
        const sJson = (await sRes.json()) as Stats;

        if (alive) {
          setProfile(pJson);
          setRecent(Array.isArray(rJson) ? rJson : []);
          setStats(sJson);
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed to load dashboard data.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [API_BASE]);

  const avgScore = useMemo(() => {
    if (profile?.ma?.overall == null) return null;
    return Number(profile.ma.overall.toFixed(1));
  }, [profile]);

  const totalPracticeTimeDisplay = useMemo(() => {
    if (!stats) return "—";
    // tampilkan jam dengan 1 desimal, mis. "2.3 hours"
    return `${stats.total_hours.toFixed(1)} hours`;
  }, [stats]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Dashboard</h1>
          <Link
            href="/"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {loading ? (
          <div className="w-full max-w-6xl text-gray-500">Loading…</div>
        ) : err ? (
          <div className="w-full max-w-6xl text-red-600">
            Failed to load: {err}
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-2">Total Practice Time</h2>
                <p className="text-3xl font-bold text-blue-600">
                  {totalPracticeTimeDisplay}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  ({stats?.total_minutes.toFixed(0)} minutes)
                </p>
              </div>

              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-2">Sessions Completed</h2>
                <p className="text-3xl font-bold text-blue-600">
                  {profile?.sessions_count ?? 0}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Level: <span className="font-semibold">{profile?.level ?? "-"}</span>{" "}
                  • Target: <span className="font-semibold">{profile?.target_cefr ?? "-"}</span>
                </p>
              </div>

              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-2">Average Score</h2>
                <p className="text-3xl font-bold text-blue-600">
                  {avgScore != null ? `${avgScore}/10` : "—"}
                </p>
                {profile && (
                  <div className="text-xs text-gray-600 mt-3 space-y-1">
                    <div>Pronunciation: {profile.ma.pronunciation.toFixed(1)}/10</div>
                    <div>Grammar: {profile.ma.grammar.toFixed(1)}/10</div>
                    <div>Fluency: {profile.ma.fluency.toFixed(1)}/10</div>
                    <div>Vocabulary: {profile.ma.vocabulary.toFixed(1)}/10</div>
                  </div>
                )}
              </div>
            </div>

            {/* Practice History */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Practice History</h2>
              {recent.length > 0 ? (
                <div className="divide-y">
                  {recent.map((s) => {
                    const d = new Date(s.created_at);
                    const dateLabel = isNaN(d.getTime())
                      ? s.created_at
                      : d.toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                    return (
                      <div key={s.id} className="py-3">
                        <div className="flex justify-between">
                          <h3 className="font-medium">{s.scenario}</h3>
                          <span className="text-sm text-gray-500">{dateLabel}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Score: {s.score_overall?.toFixed(1) ?? "0.0"}/10
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500">No recent practice sessions</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

