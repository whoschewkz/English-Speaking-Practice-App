import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-[#0B0F1A] dark:via-[#0B0F1A] dark:to-[#0B0F1A]">
      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[420px] w-[860px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, rgba(59,130,246,.25) 0%, rgba(59,130,246,0) 60%)",
          }}
        />
        <div className="container mx-auto max-w-6xl px-6 pt-24 pb-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
                <path fill="currentColor" d="M12 3a9 9 0 1 0 9 9a9 9 0 0 0-9-9m1 13h-2v-2h2zm0-4h-2V7h2z"/>
              </svg>
              AI Speaking Coach • TOEFL/IELTS
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              Practice English speaking with
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> real-time feedback</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
              Voice-to-text conversation, instant tips, and adaptive sessions that level up with your progress.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/practice"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus-visible:ring focus-visible:ring-blue-400"
              >
                Start Practice
                <svg className="ml-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M10.293 15.707a1 1 0 010-1.414L12.586 12H6a1 1 0 110-2h6.586l-2.293-2.293a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                </svg>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-slate-900 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring focus-visible:ring-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              >
                View Dashboard
              </Link>
            </div>

            {/* trust badges */}
            <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              Works in your browser • No installs • Voice ready
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACCESS CARDS */}
      <section className="container mx-auto max-w-6xl px-6 pb-2">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/practice/1",
              title: "Job Interview",
              desc: "Practice common interview questions and answers.",
              badge: "Structured",
            },
            {
              href: "/practice/2",
              title: "Daily Conversation",
              desc: "Casual chats for everyday fluency.",
              badge: "Warm-up",
            },
            {
              href: "/practice/3",
              title: "Business Meeting",
              desc: "Present, discuss, and negotiate clearly.",
              badge: "Professional",
            },
            {
              href: "/practice/4",
              title: "Travel Situations",
              desc: "From airport to hotel check-in.",
              badge: "On the go",
            },
          ].map((c) => (
            <Link
              key={c.title}
              href={c.href}
              className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{c.badge}</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{c.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{c.desc}</p>
              <span className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 group-hover:gap-2">
                Start
                <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 11-1.414-1.414L14.586 11H4a1 1 0 110-2h10.586l-2.293-2.293a1 1 0 010-1.414z" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="container mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Why you’ll improve faster</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Designed for measurable progress—clear feedback, adaptive difficulty, and session analytics.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M12 3a9 9 0 109 9a9 9 0 00-9-9zm1 13h-2v-2h2zm0-4h-2V7h2z" />
                  </svg>
                ),
                title: "Instant feedback",
                desc: "Short, actionable tips after every reply to fix errors quickly.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M12 3l7 6v12h-5v-6H10v6H5V9z" />
                  </svg>
                ),
                title: "Voice-to-Text",
                desc: "Speak naturally—browser captures your voice for evaluation.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M3 5h18v2H3zm2 6h14v2H5zm4 6h6v2H9z" />
                  </svg>
                ),
                title: "Adaptive sessions",
                desc: "Difficulty adjusts based on your progress and weak areas.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M11 17a4 4 0 110-8a4 4 0 010 8zm8-5a8 8 0 11-16 0a8 8 0 0116 0z" />
                  </svg>
                ),
                title: "Analytics",
                desc: "Track pronunciation, grammar, fluency & vocab over time.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">How it works</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {[
            { n: "1", t: "Pick a scenario", d: "Interview, daily talk, meetings, or travel." },
            { n: "2", t: "Speak & get tips", d: "Real-time feedback for each response." },
            { n: "3", t: "See progress", d: "View scores & trends on your dashboard." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {s.n}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{s.t}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-white/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <div className="container mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white md:flex-row">
            <div>
              <h3 className="text-2xl font-bold">Ready to speak with confidence?</h3>
              <p className="mt-1 text-blue-100">Start your first session now and get instant feedback.</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/practice"
                className="inline-flex items-center rounded-xl bg-white px-5 py-3 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                Start Practice
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-xl border border-white/30 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
