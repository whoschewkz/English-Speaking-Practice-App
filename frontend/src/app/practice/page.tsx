"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
type Scenario = { id: number; title: string; description?: string | null };
type SessionRow = {
  id: number;
  scenario: string;
  score_overall: number;
  created_at: string; // ISO
};

// ──────────────────────────────────────────────────────────────────────────────
// Simple inline icons (no external libraries)
// ──────────────────────────────────────────────────────────────────────────────
const Icon = {
  Bot: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <rect x="4" y="8" width="16" height="10" rx="2"/>
      <path d="M12 2v4"/>
      <circle cx="9" cy="12" r="1"/>
      <circle cx="15" cy="12" r="1"/>
    </svg>
  ),
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 5v14l11-7-11-7z"/>
    </svg>
  ),
  Rocket: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M5 15c-1.5 1.5-2 4-2 4s2.5-.5 4-2l8.5-8.5a4 4 0 1 0-5.7-5.7L5 9"/>
      <path d="M15 9l-6 6"/>
      <path d="M9 15s-.5 2.5-2 4c-1.5 1.5-4 2-4 2s.5-2.5 2-4c1.5-1.5 4-2 4-2z"/>
    </svg>
  ),
  Alert: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M12 9v4"/>
      <path d="M12 17h.01"/>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    </svg>
  ),
  History: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M3 3v5h5"/>
      <path d="M3.05 13A9 9 0 1 0 8 4.6L3 8"/>
      <path d="M12 7v5l3 3"/>
    </svg>
  ),
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M5 12h14"/>
      <path d="M12 5l7 7-7 7"/>
    </svg>
  ),
  List: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/>
    </svg>
  ),
  Grid: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Sun: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07-1.41-1.41M6.46 6.46 5.05 5.05m12.02 0-1.41 1.41M6.46 17.54l-1.41 1.41"/>
    </svg>
  ),
  Moon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
};

// Extra icons injected for theme toggle
const IconExtra = {
  Sun: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  Moon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
};
// merge into Icon without changing existing references
Object.assign(Icon, IconExtra as any);

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
export default function PracticePage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [recent, setRecent] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [listView, setListView] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
      const preferDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = stored ? stored === 'dark' : preferDark;
      if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', initial);
      setIsDark(initial);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', next);
    try { if (typeof window !== 'undefined') localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };
  const [darkMode, setDarkMode] = useState(false);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    []
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkMode");
      if (saved) {
        const isDark = saved === "true";
        setDarkMode(isDark);
        document.documentElement.classList.toggle("dark", isDark);
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const [s1, s2] = await Promise.all([
          fetch(`${API_BASE}/api/scenarios`, { signal: ctrl.signal }),
          fetch(`${API_BASE}/api/sessions/recent?limit=10`, { signal: ctrl.signal }),
        ]);
        if (!s1.ok) throw new Error((await s1.text()) || `Failed to load scenarios (${s1.status}).`);
        if (!s2.ok) throw new Error((await s2.text()) || `Failed to load recent sessions (${s2.status}).`);
        const scenariosJson = (await s1.json()) as Scenario[];
        const recentJson = (await s2.json()) as SessionRow[];
        setScenarios(scenariosJson);
        setRecent(recentJson);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "Failed to load data.");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => ctrl.abort();
  }, [API_BASE]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("darkMode", String(next));
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black dark:text-gray-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white/70 dark:bg-gray-900/70 backdrop-blur border-b border-gray-200 dark:border-gray-700">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon.Bot className="h-6 w-6 text-violet-600" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Speaking Practice</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800">
              {darkMode ? <Icon.Sun className="h-5 w-5" /> : <Icon.Moon className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Icon.Sun className="h-4 w-4" /> : <Icon.Moon className="h-4 w-4" />}
              <span className="hidden sm:inline">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Back to Home
            </Link>
          </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 text-gray-900 dark:text-gray-100">
        {/* Hero */}
        <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="relative p-6 md:p-8">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-200 dark:bg-violet-900 blur-3xl opacity-40" />
            <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-blue-200 dark:bg-blue-900 blur-3xl opacity-40" />
            <div className="relative">
              <h2 className="text-xl md:text-2xl font-semibold">Improve Your Speaking</h2>
              <p className="mt-2 text-gray-600 dark:text-gray-300 max-w-2xl">
                Choose a scenario to practice, or use <span className="font-medium text-violet-700 dark:text-violet-400">Agent Mode</span> to automatically pick the next task based on your progress.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/practice/agent"
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:shadow-md transition-shadow"
                >
                  <Icon.Rocket className="h-4 w-4" />
                  Start Agent Mode
                  <Icon.ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#scenarios"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 bg-white dark:bg-gray-900"
                >
                  View Scenarios
                </a>
                {/* Icon-only compact CTA example */}
                <Link
                  href="/practice/agent"
                  className="rounded-full p-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                  aria-label="Start Agent Mode"
                  title="Start Agent Mode"
                >
                  <Icon.ArrowRight className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Error Banner */}
        {err && (
          <div className="mb-8 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200 flex items-start gap-3">
            <Icon.Alert className="h-5 w-5 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Failed to load data</p>
              <p className="text-sm opacity-90">{err}</p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                setErr(null);
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Scenarios */}
        <section id="scenarios" className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Choose a Scenario</h2>
            {!loading && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{scenarios.length} available</span>
            )}
          </div>

          {loading ? (
            <ScenarioSkeleton />
          ) : listView ? (
            <ul className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm divide-y divide-gray-200 dark:divide-gray-800">
              {/* Agent row */}
              <li className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 p-2">
                    <Icon.Rocket className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">My Plan (Agent)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI selects your next task based on progress.</p>
                  </div>
                </div>
                <Link href="/practice/agent" className="text-blue-700 dark:text-blue-400 font-medium hover:underline">
                  Start
                </Link>
              </li>
              {scenarios.map((s) => (
                <li key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <div>
                    <h3 className="font-medium">{s.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{s.description || ""}</p>
                  </div>
                  <Link href={`/practice/${s.id}`} className="inline-flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                    Start
                    <Icon.ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
              ))}
              {!loading && scenarios.length === 0 && (
                <li className="p-4">
                  <EmptyState title="No scenarios yet" desc="Add scenarios from the admin dashboard first." ctaLabel="Back to Home" href="/" />
                </li>
              )}
            </ul>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Agent Mode Card (pinned) */}
              <Link
                href={`/practice/agent`}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-start gap-3">
                  <div className="rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 p-2.5">
                    <Icon.Rocket className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">My Plan (Agent)</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">AI selects your next task based on progress.</p>
                    <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700 dark:text-violet-300">
                      Start Agent Mode <Icon.ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>

              {/* Dynamic scenarios */}
              {scenarios.map((s) => (
                <Link
                  key={s.id}
                  href={`/practice/${s.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-start gap-3">
                    <div className="rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 p-2.5">
                      <Icon.Play className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold">{s.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{s.description || ""}</p>
                      <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300">
                        Start Scenario <Icon.ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Empty state if no scenarios */}
              {!loading && scenarios.length === 0 && (
                <div className="col-span-full">
                  <EmptyState title="No scenarios yet" desc="Add scenarios from the admin dashboard first." ctaLabel="Back to Home" href="/" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Recent Sessions */}
        <section className="mb-16">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon.History className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-xl font-semibold">Recent Practice Sessions</h2>
            </div>
            {!loading && recent.length > 0 && (
              <Link href="/practice/history" className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline">
                View All
              </Link>
            )}
          </div>

          {loading ? (
            <RecentSkeleton />
          ) : recent.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              {recent.map((r) => (
                <div key={r.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-medium">{r.scenario}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{fmt.format(new Date(r.created_at))}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      Score:
                      <span className="ml-1 font-semibold">
                        {Number.isFinite(r.score_overall) ? r.score_overall.toFixed(1) : "0.0"}
                      </span>
                      /10
                    </p>
                    <Progress value={(r.score_overall / 10) * 100} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Icon.Play className="h-6 w-6" />} title="No recent practice sessions" desc="Start your first session and your progress will appear here." ctaLabel="Start Agent Mode" href="/practice/agent" />
          )}
        </section>
      </div>
    </main>
  );
}

// UI Bits
function Progress({ value = 0 }: { value?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-40 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden" aria-label="progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${v}%` }} />
    </div>
  );
}

function EmptyState({ icon, title, desc, ctaLabel, href }: { icon?: React.ReactNode; title: string; desc?: string; ctaLabel?: string; href?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center shadow-sm">
      <div className="mb-3 rounded-xl bg-gray-100 dark:bg-gray-800 p-3 text-gray-600 dark:text-gray-300">{icon ?? <Icon.Alert className="h-6 w-6" />}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {desc && <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">{desc}</p>}
      {href && ctaLabel && (
        <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-black dark:hover:bg-white/90">
          {ctaLabel}
          <Icon.ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function ScenarioSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="h-5 w-36 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="mt-3 h-4 w-full rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="mt-2 h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="mt-4 h-6 w-28 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          </div>
          <div className="mt-2 h-4 w-24 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
