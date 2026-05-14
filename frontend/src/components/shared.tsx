// src/components/shared.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { logout, TokenStore } from "@/utils/auth";

// ─── Theme hook ───────────────────────────────────────────────────────────────
export function useTheme() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const init = stored ? stored === "dark" : preferDark;
    document.documentElement.classList.toggle("dark", init);
    setDark(init);
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  return { dark, toggle, ready };
}

// ─── Icons ────────────────────────────────────────────────────────────────────
export const Icon = {
  Mic: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M12 14v4"/><path d="M8 10v2a4 4 0 0 0 8 0v-2"/><path d="M5 20h14"/>
    </svg>
  ),
  Sun: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  ),
  Moon: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  Logout: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Back: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
    </svg>
  ),
  Bolt: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  Arrow: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
    </svg>
  ),
  Spinner: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation:"spin 1s linear infinite" }} {...p}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  Check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...p}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Star: (p: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};

// ─── Btn — tombol konsisten di semua halaman ───────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Btn({
  variant = "secondary", children, disabled, loading, style: s, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; loading?: boolean;
}) {
  const base: React.CSSProperties = {
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
    padding:"9px 18px", borderRadius:12, fontSize:13, fontWeight:600,
    border:"none", cursor: (disabled||loading) ? "not-allowed" : "pointer",
    opacity: (disabled||loading) ? 0.5 : 1,
    transition:"opacity .15s, transform .1s",
    whiteSpace:"nowrap", flexShrink:0,
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary:   { background:"var(--accent)",   color:"#0c0c10" },
    secondary: { background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border2)" },
    ghost:     { background:"transparent",     color:"var(--text3)", border:"1px solid var(--border)" },
    danger:    { background:"rgba(239,68,68,0.08)", color:"var(--danger)", border:"1px solid rgba(239,68,68,0.25)" },
  };
  return (
    <button {...props} disabled={disabled||loading} style={{ ...base, ...variants[variant], ...s }}
      onMouseEnter={e => { if (!disabled&&!loading) e.currentTarget.style.opacity="0.85"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = (disabled||loading) ? "0.5" : "1"; }}>
      {loading && <Icon.Spinner width={14} height={14} />}
      {children}
    </button>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color="accent" }: { children: React.ReactNode; color?: "accent"|"warn"|"danger"|"ok"|"muted" }) {
  const colors = {
    accent: { color:"var(--accent)",  bg:"var(--accent-dim)",       border:"var(--accent-border)" },
    warn:   { color:"var(--warn)",    bg:"rgba(245,158,11,0.1)",    border:"rgba(245,158,11,0.3)" },
    danger: { color:"var(--danger)",  bg:"rgba(239,68,68,0.08)",    border:"rgba(239,68,68,0.25)" },
    ok:     { color:"var(--ok)",      bg:"rgba(16,185,129,0.1)",    border:"rgba(16,185,129,0.25)" },
    muted:  { color:"var(--text3)",   bg:"var(--surface2)",         border:"var(--border2)" },
  };
  const c = colors[color];
  return (
    <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, color:c.color, background:c.bg, border:`1px solid ${c.border}` }}>
      {children}
    </span>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style: s, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20, ...s }}>
      {children}
    </div>
  );
}

// ─── SectionLabel ──────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin:0, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--text3)" }}>
      {children}
    </p>
  );
}

// ─── ThemeToggle ──────────────────────────────────────────────────────────────
export function ThemeToggle({ size = 16 }: { size?: number }) {
  const { dark, toggle, ready } = useTheme();
  if (!ready) return <div style={{ width:32, height:32 }} />;
  return (
    <button onClick={toggle} aria-label="Toggle tema" style={{
      width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center",
      borderRadius:10, border:"none", background:"transparent", cursor:"pointer", color:"var(--text3)", transition:"background .15s, color .15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--text)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text3)"; }}>
      {dark ? <Icon.Sun width={size} height={size} /> : <Icon.Moon width={size} height={size} />}
    </button>
  );
}

// ─── NavBar ───────────────────────────────────────────────────────────────────
type NavLink = { label: string; href: string; active?: boolean };

export function NavBar({
  links = [], backHref, backLabel, centerContent, rightExtra,
}: {
  links?: NavLink[];
  backHref?: string; backLabel?: string;
  centerContent?: React.ReactNode;
  rightExtra?: React.ReactNode;
}) {
  const [username, setUsername] = useState("");
  const [role,     setRole]     = useState<string|null>(null);
  const [mounted,  setMounted]  = useState(false);
  const { dark } = useTheme();

  useEffect(() => {
    setMounted(true);
    setUsername(TokenStore.getUsername() || "");
    setRole(TokenStore.getRole());
  }, []);

  const navBg = dark ? "rgba(12,12,16,0.92)" : "rgba(246,246,248,0.92)";

  return (
    <header style={{ position:"sticky", top:0, zIndex:40, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", background:navBg, borderBottom:"1px solid var(--border)" }}>
      <div style={{ maxWidth:1152, margin:"0 auto", padding:"0 20px", height:56, display:"flex", alignItems:"center", gap:12 }}>

        {/* Back */}
        {backHref && (
          <Link href={backHref} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"var(--text3)", textDecoration:"none", flexShrink:0, transition:"color .15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>
            <Icon.Back width={13} height={13} />
            <span style={{ display:"none" }} className="sm-show">{backLabel || "Kembali"}</span>
          </Link>
        )}
        {backHref && <div style={{ width:1, height:16, background:"var(--border2)" }} />}

        {/* Logo */}
        <Link href="/practice" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none", flexShrink:0 }}>
          <div style={{ width:28, height:28, borderRadius:9, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon.Mic width={13} height={13} style={{ stroke:"#0c0c10" }} />
          </div>
          <span style={{ fontSize:14, fontWeight:700, color:"var(--text)", letterSpacing:"-0.3px" }}>BicarAI</span>
        </Link>

        {/* Nav links */}
        {links.length > 0 && (
          <nav style={{ display:"flex", alignItems:"center", gap:2, marginLeft:8 }}>
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{
                padding:"6px 12px", borderRadius:9, fontSize:13, textDecoration:"none", transition:"all .15s",
                fontWeight: l.active ? 500 : 400,
                color:      l.active ? "var(--text)"   : "var(--text3)",
                background: l.active ? "var(--surface2)" : "transparent",
              }}
                onMouseEnter={e => { if (!l.active) { e.currentTarget.style.color="var(--text)"; e.currentTarget.style.background="var(--surface2)"; }}}
                onMouseLeave={e => { if (!l.active) { e.currentTarget.style.color="var(--text3)"; e.currentTarget.style.background="transparent"; }}}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Center */}
        {centerContent && <div style={{ flex:1, display:"flex", justifyContent:"center" }}>{centerContent}</div>}

        <div style={{ flex:1 }} />

        {/* Right */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {rightExtra}

          {/* Admin badge */}
          {mounted && role === "admin" && (
            <Link href="/admin" style={{ padding:"4px 10px", borderRadius:8, fontSize:11, fontWeight:600, textDecoration:"none", color:"var(--warn)", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", transition:"background .15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(245,158,11,0.08)")}>
              Admin
            </Link>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User chip */}
          {mounted && username && (
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 12px", borderRadius:10, background:"var(--surface2)", border:"1px solid var(--border)", fontSize:13, color:"var(--text2)" }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:"var(--accent-dim)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"var(--accent)", flexShrink:0 }}>
                {username[0].toUpperCase()}
              </div>
              <span style={{ maxWidth:80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{username}</span>
            </div>
          )}

          {/* Logout */}
          <button onClick={logout} style={{
            display:"flex", alignItems:"center", gap:5, padding:"6px 10px", borderRadius:9, fontSize:12, fontWeight:500,
            border:"none", background:"transparent", cursor:"pointer", color:"var(--text3)", transition:"all .15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "transparent"; }}>
            <Icon.Logout width={14} height={14} />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── CSS helper untuk responsive (sm-show) ─────────────────────────────────
// Tambahkan ke globals.css:
// @media (min-width: 640px) { .sm-show { display: inline !important; } }
// .sm-show { display: none; }