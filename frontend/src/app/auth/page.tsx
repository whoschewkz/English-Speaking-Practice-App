"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TokenStore } from "@/utils/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthMode  = "login" | "register";
type FieldErr  = Partial<Record<"username"|"email"|"password"|"confirm"|"general", string>>;

// ─── Validators (OWASP) ───────────────────────────────────────────────────────
const validators = {
  username(v: string) {
    if (!v.trim())                          return "Username wajib diisi";
    if (v.length < 3)                       return "Minimal 3 karakter";
    if (!/^[a-zA-Z0-9_]+$/.test(v))        return "Hanya huruf, angka, dan underscore";
    return null;
  },
  email(v: string) {
    if (!v.trim())                                                         return "Email wajib diisi";
    if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(v))   return "Format email tidak valid";
    return null;
  },
  password(v: string) {
    if (!v)            return "Password wajib diisi";
    if (v.length < 8)  return "Minimal 8 karakter";
    if (!/[A-Z]/.test(v)) return "Harus ada 1 huruf besar";
    if (!/[a-z]/.test(v)) return "Harus ada 1 huruf kecil";
    if (!/\d/.test(v))    return "Harus ada 1 angka";
    return null;
  },
};

// ─── Password strength ────────────────────────────────────────────────────────
function strength(v: string): { score: number; label: string; color: string } {
  let s = 0;
  if (v.length >= 8)           s++;
  if (v.length >= 12)          s++;
  if (/[A-Z]/.test(v))         s++;
  if (/[a-z]/.test(v))         s++;
  if (/\d/.test(v))            s++;
  if (/[^a-zA-Z0-9]/.test(v)) s++;
  if (s <= 2) return { score: s, label: "Lemah",        color: "#ef4444" };
  if (s <= 4) return { score: s, label: "Sedang",       color: "#f59e0b" };
  return       { score: s, label: "Kuat",         color: "#10b981" };
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icons = {
  Mic: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M12 14v4"/><path d="M8 10v2a4 4 0 0 0 8 0v-2"/><path d="M5 20h14"/>
    </svg>
  ),
  Eye: ({ open }: { open: boolean }) => open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Alert: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
    </svg>
  ),
  Spinner: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  School: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Shield: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="1.5">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

// ─── Reusable sub-components ──────────────────────────────────────────────────
function FieldWrapper({
  label, error, optional, hint, children,
}: {
  label: string; error?: string; optional?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
        {label}
        {optional && <span className="text-slate-600 font-normal">(opsional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-600">{hint}</p>}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <Icons.Alert />
          {error}
        </p>
      )}
    </div>
  );
}

function AuthInput({
  hasError, className = "", ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return (
    <input
      {...props}
      className={[
        "w-full bg-slate-900 rounded-xl px-4 py-2.5 text-sm text-slate-100",
        "placeholder-slate-600 outline-none transition-all duration-150",
        "border",
        hasError
          ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
          : "border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20",
        className,
      ].join(" ")}
    />
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
      {icon}
      <span className="text-xs text-slate-400">{text}</span>
    </div>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs transition-colors ${met ? "text-emerald-400" : "text-slate-600"}`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${met ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700"}`}>
        {met && <Icons.Check />}
      </span>
      {text}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AuthPage() {
  const router  = useRouter();
  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

  const [mode,     setMode]     = useState<AuthMode>("login");
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<FieldErr>({});
  const [showPass, setShowPass] = useState(false);
  const [mounted,  setMounted]  = useState(false);

  // Form state
  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    setMounted(true);
    if (TokenStore.isLoggedIn()) router.replace("/practice");
  }, [router]);

  // Password strength & requirements
  const str     = mounted && password ? strength(password) : null;
  const reqMet  = {
    len:   password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
  };

  const reset      = () => { setUsername(""); setEmail(""); setPassword(""); setConfirm(""); setFullName(""); setErrors({}); };
  const switchMode = (m: AuthMode) => { setMode(m); reset(); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FieldErr = {};
    const u = validators.username(username); if (u) errs.username = u;
    if (!password) errs.password = "Password wajib diisi";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true); setErrors({});
    try {
      const res  = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors({ general: data?.detail || "Login gagal. Periksa username dan password." }); return; }
      TokenStore.set(data.access_token, data.refresh_token, data.role, data.username);
      window.location.href = data.role === "admin" ? "/admin" : "/practice";
    } catch {
      setErrors({ general: "Tidak dapat terhubung ke server. Pastikan backend berjalan." });
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FieldErr = {};
    const u  = validators.username(username); if (u)  errs.username = u;
    const em = validators.email(email);       if (em) errs.email    = em;
    const p  = validators.password(password); if (p)  errs.password = p;
    if (!confirm)                errs.confirm = "Konfirmasi password wajib diisi";
    else if (password !== confirm) errs.confirm = "Password tidak cocok";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true); setErrors({});
    try {
      const res  = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email:    email.trim().toLowerCase(),
          password,
          full_name: fullName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrors({ general: data?.detail || "Registrasi gagal." }); return; }

      // Auto-login setelah register berhasil
      const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (loginRes.ok) {
        const ld = await loginRes.json();
        TokenStore.set(ld.access_token, ld.refresh_token, ld.role, ld.username);
        window.location.href = "/practice";
      } else {
        switchMode("login");
      }
    } catch {
      setErrors({ general: "Tidak dapat terhubung ke server." });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Glow blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-950 rounded-full blur-3xl opacity-40" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-950 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative w-full max-w-md">
        {/* ── Brand header ── */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 ring-4 ring-indigo-500/20">
            <Icons.Mic />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-1">SpeakEng</h1>
          <p className="text-slate-400 text-sm">Platform latihan berbicara bahasa Inggris</p>
          <p className="text-slate-500 text-xs mt-1">Unit Bahasa — Berbasis AI + Evaluasi CEFR</p>
        </div>

        {/* ── Feature pills ── */}
        <div className="flex justify-center gap-2 flex-wrap mb-6">
          <FeaturePill icon={<Icons.School />} text="Untuk mahasiswa" />
          <FeaturePill icon={<Icons.Shield />} text="Login aman" />
          <FeaturePill icon={<Icons.Chart />}  text="Progres CEFR" />
        </div>

        {/* ── Auth card ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-slate-800">
            {(["login", "register"] as AuthMode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={[
                  "flex-1 py-3.5 text-sm font-medium transition-all duration-200",
                  mode === m
                    ? "text-white bg-slate-800/60 border-b-2 border-indigo-500 shadow-inner"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30",
                ].join(" ")}
              >
                {m === "login" ? "Masuk" : "Daftar Akun"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* General error banner */}
            {errors.general && (
              <div className="mb-5 flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                <Icons.Alert />
                <span>{errors.general}</span>
              </div>
            )}

            <form
              onSubmit={mode === "login" ? handleLogin : handleRegister}
              noValidate
              className="flex flex-col gap-4"
            >
              {/* ─ Full name (register only) ─ */}
              {mode === "register" && (
                <FieldWrapper label="Nama lengkap" optional>
                  <AuthInput
                    type="text"
                    placeholder="Nama lengkap kamu"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </FieldWrapper>
              )}

              {/* ─ Username ─ */}
              <FieldWrapper label="Username" error={errors.username}>
                <AuthInput
                  type="text"
                  placeholder="username_kamu"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setErrors(p => ({ ...p, username: undefined })); }}
                  autoComplete="username"
                  autoFocus
                  hasError={!!errors.username}
                />
              </FieldWrapper>

              {/* ─ Email (register only) ─ */}
              {mode === "register" && (
                <FieldWrapper label="Email" error={errors.email}>
                  <AuthInput
                    type="email"
                    placeholder="kamu@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                    autoComplete="email"
                    hasError={!!errors.email}
                  />
                </FieldWrapper>
              )}

              {/* ─ Password ─ */}
              <FieldWrapper label="Password" error={errors.password}>
                <div className="relative">
                  <AuthInput
                    type={showPass ? "text" : "password"}
                    placeholder={mode === "login" ? "Password kamu" : "Minimal 8 karakter"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    hasError={!!errors.password}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                    aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                  >
                    <Icons.Eye open={showPass} />
                  </button>
                </div>

                {/* Password strength meter (register only) */}
                {mode === "register" && password && str && (
                  <div className="mt-2 space-y-2">
                    {/* Bar */}
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6].map(i => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: i <= str.score ? str.color : "#1e293b" }}
                        />
                      ))}
                    </div>
                    <p className="text-xs transition-colors" style={{ color: str.color }}>
                      Kekuatan password: {str.label}
                    </p>
                  </div>
                )}

                {/* Password requirements checklist (register only) */}
                {mode === "register" && password && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <RequirementItem met={reqMet.len}   text="Min. 8 karakter" />
                    <RequirementItem met={reqMet.upper} text="1 huruf besar" />
                    <RequirementItem met={reqMet.lower} text="1 huruf kecil" />
                    <RequirementItem met={reqMet.digit} text="1 angka" />
                  </div>
                )}
              </FieldWrapper>

              {/* ─ Confirm password (register only) ─ */}
              {mode === "register" && (
                <FieldWrapper label="Konfirmasi password" error={errors.confirm}>
                  <div className="relative">
                    <AuthInput
                      type={showPass ? "text" : "password"}
                      placeholder="Ulangi password kamu"
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: undefined })); }}
                      autoComplete="new-password"
                      hasError={!!errors.confirm}
                      className="pr-10"
                    />
                    {/* Match indicator */}
                    {confirm && (
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center ${password === confirm ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {password === confirm
                          ? <Icons.Check />
                          : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        }
                      </div>
                    )}
                  </div>
                </FieldWrapper>
              )}

              {/* ─ Submit button ─ */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1 ring-2 ring-transparent focus:ring-indigo-500/40"
              >
                {loading ? (
                  <><Icons.Spinner />{mode === "login" ? "Masuk…" : "Mendaftar…"}</>
                ) : (
                  mode === "login" ? "Masuk ke Platform" : "Buat Akun Sekarang"
                )}
              </button>

              {/* ─ Helper text ─ */}
              {mode === "login" ? (
                <p className="text-center text-xs text-slate-600 mt-1">
                  Lupa password? Hubungi admin Unit Bahasa.
                </p>
              ) : (
                <p className="text-center text-xs text-slate-600 mt-1">
                  Dengan mendaftar, kamu setuju menggunakan platform ini untuk keperluan akademik.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* ─ Info footer ─ */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-slate-600">
            Platform ini menggunakan enkripsi JWT dan bcrypt untuk keamanan akunmu.
          </p>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Kembali ke beranda
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important;
          -webkit-text-fill-color: #f1f5f9 !important;
          caret-color: #f1f5f9;
        }
      `}</style>
    </main>
  );
}