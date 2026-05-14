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
  if (s <= 2) return { score: s, label: "Lemah",  color: "var(--danger)" };
  if (s <= 4) return { score: s, label: "Sedang", color: "var(--warn)" };
  return       { score: s, label: "Kuat",   color: "var(--accent)" };
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Chart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
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
      <label className="text-xs font-medium flex items-center gap-1" style={{ color:"var(--text3)" }}>
        {label}
        {optional && <span className="font-normal">(opsional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs" style={{ color:"var(--text3)" }}>{hint}</p>}
      {error && (
        <p className="text-xs flex items-center gap-1" style={{ color:"var(--danger)" }}>
          <Icons.Alert />
          {error}
        </p>
      )}
    </div>
  );
}

function AuthInput({
  hasError, className = "", style: extStyle, onFocus, onBlur, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return (
    <input
      {...props}
      className={["w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all duration-150", className].join(" ")}
      style={{
        background:   "var(--surface2)",
        border:       `1px solid ${hasError ? "var(--danger)" : "var(--border)"}`,
        color:        "var(--text)",
        ...extStyle,
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = hasError ? "var(--danger)" : "var(--accent)";
        e.currentTarget.style.boxShadow   = `0 0 0 3px ${hasError ? "rgba(239,68,68,0.1)" : "rgba(0,200,150,0.1)"}`;
        onFocus?.(e);
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = hasError ? "var(--danger)" : "var(--border)";
        e.currentTarget.style.boxShadow   = "none";
        onBlur?.(e);
      }}
    />
  );
}

function FeaturePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{ background:"var(--surface2)", border:"1px solid var(--border)" }}>
      {icon}
      <span className="text-xs" style={{ color:"var(--text3)" }}>{text}</span>
    </div>
  );
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs transition-colors"
      style={{ color: met ? "var(--accent)" : "var(--text3)" }}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center transition-colors"
        style={{ background: met ? "rgba(0,200,150,0.15)" : "var(--border2)", color: met ? "var(--accent)" : "transparent" }}>
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
    if (TokenStore.isLoggedIn()) {
      const role = TokenStore.getRole();
      router.replace(
        role === "admin"  ? "/admin"  :
        (role === "rater1" || role === "rater2") ? "/rater" :
        "/practice"
      );
    }
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
      window.location.href = data.role === "admin" ? "/admin" :
        (data.role === "rater1" || data.role === "rater2") ? "/rater" :
        "/practice";
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

  if (!mounted) return <div style={{ minHeight:"100vh", background:"var(--bg)" }} />;

  return (
    <main className="relative overflow-hidden flex items-center justify-center p-4"
      style={{ minHeight:"100vh", background:"var(--bg)" }}>

      {/* Background subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{ backgroundImage:"radial-gradient(var(--border2) 1px, transparent 1px)", backgroundSize:"28px 28px", opacity:0.7 }} />
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background:"var(--accent)", opacity:0.06 }} />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full blur-3xl"
          style={{ background:"var(--accent)", opacity:0.04 }} />
      </div>

      <div className="relative w-full max-w-md">

        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background:"var(--accent)" }}>
            <Icons.Mic />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color:"var(--text)" }}>BicarAI</h1>
          <p className="text-sm" style={{ color:"var(--text2)" }}>Platform latihan berbicara bahasa Inggris</p>
          <p className="text-xs mt-1" style={{ color:"var(--text3)" }}>Unit Bahasa Poltek SSN · Evaluasi CEFR</p>
        </div>

        {/* Feature pills */}
        <div className="flex justify-center gap-2 flex-wrap mb-6">
          <FeaturePill icon={<Icons.School />} text="Untuk mahasiswa" />
          <FeaturePill icon={<Icons.Chart />}  text="Progres CEFR" />
        </div>

        {/* Auth card */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>

          {/* Tab switcher */}
          <div className="flex" style={{ borderBottom:"1px solid var(--border)" }}>
            {(["login", "register"] as AuthMode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className="flex-1 py-3.5 text-sm font-medium transition-all duration-200"
                style={{
                  color:        mode === m ? "var(--text)" : "var(--text3)",
                  background:   mode === m ? "var(--surface2)" : "transparent",
                  borderBottom: mode === m ? "2px solid var(--accent)" : "2px solid transparent",
                }}>
                {m === "login" ? "Masuk" : "Daftar Akun"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {errors.general && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
                style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", color:"var(--danger)" }}>
                <Icons.Alert />
                <span>{errors.general}</span>
              </div>
            )}

            <form onSubmit={mode === "login" ? handleLogin : handleRegister} noValidate className="flex flex-col gap-4">

              {mode === "register" && (
                <FieldWrapper label="Nama lengkap" optional>
                  <AuthInput type="text" placeholder="Nama lengkap kamu" value={fullName}
                    onChange={e => setFullName(e.target.value)} autoComplete="name" />
                </FieldWrapper>
              )}

              <FieldWrapper label="Username" error={errors.username}>
                <AuthInput type="text" placeholder="username_kamu" value={username} autoFocus
                  onChange={e => { setUsername(e.target.value); setErrors(p => ({ ...p, username: undefined })); }}
                  autoComplete="username" hasError={!!errors.username} />
              </FieldWrapper>

              {mode === "register" && (
                <FieldWrapper label="Email" error={errors.email}>
                  <AuthInput type="email" placeholder="kamu@email.com" value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                    autoComplete="email" hasError={!!errors.email} />
                </FieldWrapper>
              )}

              <FieldWrapper label="Password" error={errors.password}>
                <div className="relative">
                  <AuthInput type={showPass ? "text" : "password"}
                    placeholder={mode === "login" ? "Password kamu" : "Minimal 8 karakter"}
                    value={password} className="pr-10"
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    hasError={!!errors.password} />
                  <button type="button" onClick={() => setShowPass(!showPass)} tabIndex={-1}
                    aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors p-0.5"
                    style={{ color:"var(--text3)" }}>
                    <Icons.Eye open={showPass} />
                  </button>
                </div>

                {mode === "register" && password && str && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: i <= str.score ? str.color : "var(--border2)" }} />
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: str.color }}>Kekuatan: {str.label}</p>
                  </div>
                )}

                {mode === "register" && password && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <RequirementItem met={reqMet.len}   text="Min. 8 karakter" />
                    <RequirementItem met={reqMet.upper} text="1 huruf besar" />
                    <RequirementItem met={reqMet.lower} text="1 huruf kecil" />
                    <RequirementItem met={reqMet.digit} text="1 angka" />
                  </div>
                )}
              </FieldWrapper>

              {mode === "register" && (
                <FieldWrapper label="Konfirmasi password" error={errors.confirm}>
                  <div className="relative">
                    <AuthInput type={showPass ? "text" : "password"} placeholder="Ulangi password kamu"
                      value={confirm} className="pr-10"
                      onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: undefined })); }}
                      autoComplete="new-password" hasError={!!errors.confirm} />
                    {confirm && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: password===confirm ? "rgba(0,200,150,0.15)" : "rgba(239,68,68,0.15)",
                                 color:      password===confirm ? "var(--accent)" : "var(--danger)" }}>
                        {password === confirm
                          ? <Icons.Check />
                          : <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                      </div>
                    )}
                  </div>
                </FieldWrapper>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1 active:scale-[0.98]"
                style={{ background:"var(--accent)", color:"#0c0c10" }}>
                {loading
                  ? <><Icons.Spinner />{mode === "login" ? "Masuk…" : "Mendaftar…"}</>
                  : mode === "login" ? "Masuk" : "Buat Akun"}
              </button>

              <p className="text-center text-xs mt-1" style={{ color:"var(--text3)" }}>
                {mode === "login"
                  ? "Lupa password? Hubungi admin Unit Bahasa."
                  : "Gunakan platform ini untuk keperluan akademik."}
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <Link href="/" className="text-sm transition-colors" style={{ color:"var(--text3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text2)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}>
            ← Kembali ke beranda
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px var(--surface2) inset !important;
          -webkit-text-fill-color: var(--text) !important;
        }
      `}</style>
    </main>
  );
}