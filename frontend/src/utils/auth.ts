// frontend/src/utils/auth.ts

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

// ─── Token Store ──────────────────────────────────────────────────────────────
export const TokenStore = {
  set(access: string, refresh: string, role: string, username: string) {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("access_token", access);
    sessionStorage.setItem("refresh_token", refresh);
    sessionStorage.setItem("role", role);
    sessionStorage.setItem("username", username);
    document.cookie = `is_authenticated=true; path=/; SameSite=Strict`;
    document.cookie = `user_role=${role}; path=/; SameSite=Strict`;
  },
  getAccess():   string | null { return typeof window !== "undefined" ? sessionStorage.getItem("access_token")  : null; },
  getRefresh():  string | null { return typeof window !== "undefined" ? sessionStorage.getItem("refresh_token") : null; },
  getRole():     string | null { return typeof window !== "undefined" ? sessionStorage.getItem("role")          : null; },
  getUsername(): string | null { return typeof window !== "undefined" ? sessionStorage.getItem("username")      : null; },
  isLoggedIn():  boolean       { return !!this.getAccess(); },
  clear() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("username");
    document.cookie = "is_authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  },
};

// ─── Auto-refresh fetch ───────────────────────────────────────────────────────
let _isRefreshing = false;
let _refreshQueue: Array<() => void> = [];

async function _doRefresh(): Promise<string | null> {
  const refreshToken = TokenStore.getRefresh();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) { TokenStore.clear(); return null; }
    const data = await res.json();
    TokenStore.set(data.access_token, data.refresh_token, data.role, data.username);
    return data.access_token;
  } catch {
    TokenStore.clear();
    return null;
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = TokenStore.getAccess();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    if (!_isRefreshing) {
      _isRefreshing = true;
      const newToken = await _doRefresh();
      _isRefreshing = false;
      _refreshQueue.forEach((cb) => cb());
      _refreshQueue = [];
      if (!newToken) {
        if (typeof window !== "undefined") window.location.href = "/auth";
        return new Response(null, { status: 401 });
      }
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    } else {
      await new Promise<void>((resolve) => { _refreshQueue.push(resolve); });
      const newToken = TokenStore.getAccess();
      if (newToken) headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    }
  }
  return res;
}

// authFetch khusus FormData (tidak set Content-Type, biarkan browser set boundary)
export async function authFetchForm(url: string, formData: FormData): Promise<Response> {
  const token = TokenStore.getAccess();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { method: "POST", headers, body: formData });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export function logout() {
  const refreshToken = TokenStore.getRefresh();
  TokenStore.clear();
  window.location.href = "/auth";
  // Fire-and-forget: invalidate refresh token di server (best effort)
  if (refreshToken) {
    fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {});
  }
}

// ─── useAuth hook ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role,       setRole]       = useState<string | null>(null);
  const [username,   setUsername]   = useState<string | null>(null);
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => {
    setIsLoggedIn(TokenStore.isLoggedIn());
    setRole(TokenStore.getRole());
    setUsername(TokenStore.getUsername());
    setMounted(true);
  }, []);

  return { isLoggedIn, role, username, mounted, logout };
}