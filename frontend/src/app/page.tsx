// src/app/page.tsx
// Server Component — semua styling via <style> tag di bawah, tidak butuh file CSS terpisah
import Link from "next/link";

const SCENARIOS = [
  { href:"/practice/1", title:"Job Interview",      desc:"Latihan pertanyaan wawancara kerja umum dan profesional.", tag:"Karier",      accent:"#818cf8" },
  { href:"/practice/2", title:"Daily Conversation", desc:"Percakapan sehari-hari untuk melatih kelancaran berbicara.",       tag:"Sosial",      accent:"#00c896" },
  { href:"/practice/3", title:"Business Meeting",   desc:"Presentasi, diskusi, dan negosiasi secara profesional.",   tag:"Profesional", accent:"#60a5fa" },
  { href:"/practice/4", title:"Travel Situations",  desc:"Dari bandara hingga check-in hotel dalam bahasa Inggris.", tag:"Perjalanan",  accent:"#f472b6" },
];

const FEATURES = [
  { emoji:"💬", title:"Feedback instan",    desc:"Tips singkat dan yang bisa langsung diterapkan setelah setiap jawaban untuk memperbaiki kesalahan." },
  { emoji:"🎙️", title:"Voice-to-Text",     desc:"Berbicara secara alami — browser merekam suaramu untuk dievaluasi AI." },
  { emoji:"⚡",  title:"Sesi adaptif (AI)", desc:"AI memilihkan skenario dan tingkat kesulitan berdasarkan progres dan kelemahanmu." },
  { emoji:"📊", title:"Analitik CEFR",      desc:"Pantau perkembangan kosakata, tata bahasa, kelancaran, koherensi, dan pelafalan." },
];

const HOW = [
  { n:"1", t:"Pilih skenario",         d:"Interview, percakapan harian, rapat bisnis, atau perjalanan." },
  { n:"2", t:"Berbicara & dapat tips", d:"Feedback real-time setelah setiap respons dari AI." },
  { n:"3", t:"Lihat progres",          d:"Pantau skor dan tren kemampuan di dashboard pribadimu." },
];

export default function Home() {
  return (
    <main className="home-root">

      {/* ── Navbar ── */}
      <header className="home-nav">
        <div className="home-nav-inner">
          <div className="home-logo">
            <div className="home-logo-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0c0c10" strokeWidth="2.5">
                <rect x="9" y="2" width="6" height="12" rx="3"/>
                <path d="M12 14v4"/><path d="M8 10v2a4 4 0 0 0 8 0v-2"/>
              </svg>
            </div>
            <span className="home-logo-text">SpeakEng</span>
          </div>
          <div className="home-nav-right">
            <Link href="/auth"     className="btn-ghost-sm">Masuk</Link>
            <Link href="/practice" className="btn-accent-sm">Mulai Latihan</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-glow" aria-hidden />
        <div className="hero-inner">
          <div className="hero-badge">
            <div className="hero-badge-dot" />
            AI Speaking Coach · Evaluasi CEFR · Unit Bahasa Poltek SSN
          </div>
          <h1 className="hero-title">
            Tingkatkan kemampuan <span className="hero-accent">berbicara</span> bahasa Inggris
          </h1>
          <p className="hero-sub">
            Percakapan berbasis AI dengan feedback real-time, penilaian CEFR otomatis, dan sesi adaptif yang menyesuaikan progresmu.
          </p>
          <div className="hero-btns">
            <Link href="/practice" className="btn-primary-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Mulai Latihan
            </Link>
            <Link href="/dashboard" className="btn-secondary-lg">
              Lihat Progres
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
          {/* Stats inline — lebih ringkas, dot separator sebagai ritme visual */}
          <div className="hero-stats-inline">
            <span className="hero-stat-chip"><strong>5</strong> dimensi CEFR</span>
            <span className="hero-stat-sep">·</span>
            <span className="hero-stat-chip">Rentang <strong>A2–C2</strong></span>
            <span className="hero-stat-sep">·</span>
            <span className="hero-stat-chip"><strong>LLaMA 3.3</strong> + Whisper</span>
          </div>
        </div>
      </section>

      {/* ── Scenario cards ── */}
      <section className="section-wrap">
        <div className="section-head">
          <div>
            <p className="section-eyebrow">Pilih skenario</p>
            <h2 className="section-title">Mulai langsung dari skenario</h2>
          </div>
          <Link href="/practice" className="link-subtle">Lihat semua →</Link>
        </div>
        <div className="scenarios-grid">
          {SCENARIOS.map(c => (
            <Link key={c.title} href={c.href} className="scenario-card"
              style={{ "--sc-accent": c.accent } as React.CSSProperties}>
              <span className="scenario-tag"
                style={{ color:c.accent, background:`${c.accent}14`, borderColor:`${c.accent}30` }}>
                {c.tag}
              </span>
              <h3 className="scenario-name">{c.title}</h3>
              <p className="scenario-desc">{c.desc}</p>
              <span className="scenario-cta" style={{ color:c.accent }}>
                Mulai latihan
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        <div className="section-wrap" style={{ padding:"0 24px" }}>
          <div className="features-grid">
            <div className="features-left">
              <p className="section-eyebrow">Kenapa lebih efektif</p>
              <h2 className="section-title">Dirancang untuk kemajuan yang terukur</h2>
              <p className="features-sub">
                Feedback jelas, kesulitan adaptif, dan analitik sesi membuatmu bisa melacak perkembangan nyata.
              </p>
              <Link href="/practice/agent" className="ai-pill">
                <div className="ai-pill-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0c0c10" strokeWidth="2.5">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                <div>
                  <p className="ai-pill-title">Coba AI Plan</p>
                  <p className="ai-pill-sub">AI pilihkan skenario terbaik untukmu</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" className="ai-pill-arrow">
                  <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>
            <div className="feature-cards">
              {FEATURES.map(f => (
                <div key={f.title} className="feature-card">
                  <span className="feature-emoji">{f.emoji}</span>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section-wrap">
        {/* Left-aligned — variasi dari section lain yang center */}
        <div className="how-head">
          <p className="section-eyebrow">Cara kerja</p>
          <h2 className="section-title">Mulai dalam 3 langkah</h2>
        </div>
        <div className="how-grid">
          {HOW.map(s => (
            <div key={s.n} className="how-card">
              <div className="how-num">{s.n}</div>
              <h3 className="how-title">{s.t}</h3>
              <p className="how-desc">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="cta-section">
        <div className="section-wrap" style={{ paddingBottom:48 }}>
          <div className="cta-banner">
            <div>
              <h3 className="cta-title">Siap berbicara dengan percaya diri?</h3>
              <p className="cta-sub">Mulai sesi pertamamu sekarang dan dapatkan feedback instan dari AI.</p>
            </div>
            <div className="cta-btns">
              <Link href="/practice" className="cta-btn-dark">Mulai Latihan</Link>
              <Link href="/auth"     className="cta-btn-outline">Daftar Akun</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="home-footer">
        <p>© 2025 SpeakEng · Unit Bahasa Poltek SSN · Next.js + FastAPI + LLaMA 3.3</p>
      </footer>

      {/* ═══ Styles — semua di sini, tidak butuh file CSS terpisah ═══ */}
      <style>{`
        .home-root { min-height: 100vh; background: var(--bg); color: var(--text); }

        /* ─ Navbar ─ */
        .home-nav {
          position: sticky; top: 0; z-index: 40;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: color-mix(in srgb, var(--bg) 92%, transparent);
          border-bottom: 1px solid var(--border);
        }
        .home-nav-inner {
          max-width: 1152px; margin: 0 auto;
          padding: 0 24px; height: 56px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .home-logo { display: flex; align-items: center; gap: 9px; }
        .home-logo-icon {
          width: 28px; height: 28px; border-radius: 9px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
        }
        .home-logo-text { font-size: 14px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .home-nav-right { display: flex; align-items: center; gap: 8px; }

        /* ─ Buttons ─ */
        .btn-ghost-sm {
          padding: 6px 14px; border-radius: 10px;
          font-size: 13px; font-weight: 500;
          color: var(--text2); text-decoration: none;
          border: 1px solid var(--border2); background: var(--surface);
          transition: background .15s, color .15s;
        }
        .btn-ghost-sm:hover { background: var(--surface2); color: var(--text); }

        .btn-accent-sm {
          padding: 6px 14px; border-radius: 10px;
          font-size: 13px; font-weight: 700;
          color: #0c0c10; text-decoration: none;
          background: var(--accent);
          transition: opacity .15s;
        }
        .btn-accent-sm:hover { opacity: 0.88; }

        .btn-primary-lg {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 24px; border-radius: 14px;
          font-size: 14px; font-weight: 700;
          background: var(--accent); color: #0c0c10; text-decoration: none;
          box-shadow: 0 8px 24px rgba(0, 200, 150, 0.25);
          transition: opacity .15s, transform .1s;
        }
        .btn-primary-lg:hover  { opacity: 0.9; }
        .btn-primary-lg:active { transform: scale(0.98); }

        .btn-secondary-lg {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 24px; border-radius: 14px;
          font-size: 14px; font-weight: 600;
          background: var(--surface); color: var(--text2); text-decoration: none;
          border: 1px solid var(--border2);
          transition: background .15s, color .15s;
        }
        .btn-secondary-lg:hover { background: var(--surface2); color: var(--text); }

        .link-subtle {
          font-size: 13px; color: var(--accent);
          text-decoration: none; font-weight: 500;
          transition: opacity .15s;
        }
        .link-subtle:hover { opacity: 0.7; }

        /* ─ Hero ─ */
        .hero-section { position: relative; overflow: hidden; padding: 88px 24px 64px; }
        .hero-glow {
          pointer-events: none; position: absolute;
          top: -10%; left: 50%; transform: translateX(-50%);
          width: 700px; height: 500px; border-radius: 50%; filter: blur(80px);
          background: radial-gradient(60% 60% at 50% 50%, rgba(0, 200, 150, 0.10) 0%, transparent 70%);
        }
        .hero-inner { max-width: 720px; margin: 0 auto; text-align: center; position: relative; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px; border-radius: 20px;
          border: 1px solid var(--border2); background: var(--surface);
          font-size: 12px; font-weight: 500; color: var(--text2);
          margin-bottom: 20px;
        }
        .hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
          animation: pulse-dot 2s ease-in-out infinite;
        }
        .hero-title {
          margin: 0 0 16px;
          font-size: clamp(30px, 5vw, 50px);
          font-weight: 800; letter-spacing: -1.5px; line-height: 1.1;
          color: var(--text);
        }
        .hero-accent { color: var(--accent); }
        .hero-sub {
          margin: 0 auto 32px; font-size: 17px;
          color: var(--text2); line-height: 1.7; max-width: 560px;
        }
        .hero-btns {
          display: flex; justify-content: center;
          gap: 10px; flex-wrap: wrap; margin-bottom: 40px;
        }
        /* Inline stats — separator dot, tidak butuh kolom sejajar */
        .hero-stats-inline {
          display: flex; align-items: center; justify-content: center;
          flex-wrap: wrap; gap: 4px 6px;
          font-size: 12px; color: var(--text3);
        }
        .hero-stat-chip { white-space: nowrap; }
        .hero-stat-chip strong { color: var(--text2); font-weight: 700; }
        .hero-stat-sep { color: var(--border2); font-size: 18px; line-height: 1; padding: 0 2px; }

        /* ─ Section shared ─ */
        .section-wrap { max-width: 1152px; margin: 0 auto; padding: 0 24px 64px; }
        .section-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          flex-wrap: wrap; gap: 8px; margin-bottom: 24px;
        }
        .section-eyebrow {
          margin: 0 0 4px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3);
        }
        .section-title { margin: 0; font-size: 20px; font-weight: 800; color: var(--text); }

        /* ─ Scenario cards ─ */
        .scenarios-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }
        .scenario-card {
          display: block; text-decoration: none;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 20px; padding: 22px 20px;
          transition: border-color .15s, box-shadow .15s, transform .15s;
        }
        .scenario-card:hover {
          border-color: var(--sc-accent, var(--accent));
          box-shadow: 0 4px 20px color-mix(in srgb, var(--sc-accent, var(--accent)) 12%, transparent);
          transform: translateY(-2px);
        }
        .scenario-tag {
          display: inline-block; margin-bottom: 14px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
          border: 1px solid transparent;
        }
        .scenario-name { margin: 0 0 6px; font-size: 15px; font-weight: 700; color: var(--text); }
        .scenario-desc { margin: 0 0 16px; font-size: 13px; color: var(--text2); line-height: 1.55; }
        .scenario-cta {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 13px; font-weight: 600;
          transition: gap .15s;
        }
        .scenario-card:hover .scenario-cta { gap: 8px; }

        /* ─ Features ─ */
        .features-section {
          background: var(--surface2);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 64px 0;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 32px; align-items: start;
          max-width: 1104px; margin: 0 auto;
        }
        .features-left { display: flex; flex-direction: column; }
        .features-sub  { margin: 0 0 20px; font-size: 14px; color: var(--text2); line-height: 1.7; }

        .ai-pill {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px; border-radius: 16px; text-decoration: none;
          background: var(--accent-dim); border: 1px solid var(--accent-border);
          transition: background .15s;
        }
        .ai-pill:hover { background: rgba(0, 200, 150, 0.18); }
        .ai-pill-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ai-pill-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--text); }
        .ai-pill-sub   { margin: 0; font-size: 12px; color: var(--text2); }
        .ai-pill-arrow { margin-left: auto; flex-shrink: 0; }

        .feature-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .feature-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 18px 16px;
          transition: box-shadow .15s;
        }
        .feature-card:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06); }
        .feature-emoji { font-size: 22px; display: block; margin-bottom: 10px; }
        .feature-title { margin: 0 0 5px; font-size: 14px; font-weight: 700; color: var(--text); }
        .feature-desc  { margin: 0; font-size: 12px; color: var(--text2); line-height: 1.55; }

        /* ─ How ─ */
        /* Left-align untuk variasi dari section lain yang center */
        .how-head { text-align: left; margin-bottom: 48px; }
        .how-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0 40px;
        }
        /* Hapus card box — hanya border kiri sebagai separator */
        .how-card {
          background: none; border: none; border-radius: 0;
          border-left: 1.5px solid var(--border);
          padding: 0 0 40px 24px;
        }
        /* Angka besar editorial — abu-abu muted di atas judul */
        .how-num {
          display: block;
          font-size: 64px; font-weight: 900; line-height: 1;
          color: var(--border2);
          letter-spacing: -4px;
          margin-bottom: 10px;
          /* Reset old box styles */
          width: auto; height: auto;
          border-radius: 0; background: none; border: none;
        }
        .how-title { margin: 0 0 8px; font-size: 15px; font-weight: 800; color: var(--text); }
        .how-desc  { margin: 0; font-size: 13px; color: var(--text2); line-height: 1.6; }

        /* ─ CTA ─ */
        .cta-section { background: var(--surface2); border-top: 1px solid var(--border); }
        .cta-banner {
          border-radius: 24px;
          padding: 40px 32px;
          display: flex; flex-wrap: wrap; align-items: center;
          justify-content: space-between; gap: 24px;
          /* Subtle diagonal-line texture — terasa hand-crafted, bukan flat solid */
          background-color: var(--accent);
          background-image: repeating-linear-gradient(
            -45deg,
            transparent 0px, transparent 10px,
            rgba(0,0,0,0.035) 10px, rgba(0,0,0,0.035) 11px
          );
        }
        .cta-title { margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #0c0c10; }
        .cta-sub   { margin: 0; font-size: 14px; color: rgba(0, 0, 0, 0.55); }
        .cta-btns  { display: flex; gap: 10px; flex-wrap: wrap; }
        .cta-btn-dark {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 22px; border-radius: 14px;
          font-size: 14px; font-weight: 700;
          background: #0c0c10; color: var(--accent); text-decoration: none;
          transition: opacity .15s;
        }
        .cta-btn-dark:hover { opacity: 0.88; }
        .cta-btn-outline {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 22px; border-radius: 14px;
          font-size: 14px; font-weight: 600;
          background: rgba(0, 0, 0, 0.12); color: #0c0c10; text-decoration: none;
          border: 1px solid rgba(0, 0, 0, 0.18);
          transition: background .15s;
        }
        .cta-btn-outline:hover { background: rgba(0, 0, 0, 0.18); }

        /* ─ Footer ─ */
        .home-footer { border-top: 1px solid var(--border); padding: 24px; text-align: center; }
        .home-footer p { margin: 0; font-size: 12px; color: var(--text3); }

        /* ─ Animations ─ */
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </main>
  );
}