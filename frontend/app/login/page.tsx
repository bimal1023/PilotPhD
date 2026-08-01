"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { API_URL } from "@/lib/api"
import { setAuthCookie, hasAuthCookie } from "@/lib/authCookie"

const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"

type Tab = "signin" | "signup"

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("signin")
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()
  const didCheck = useRef(false)

  useEffect(() => {
    if (didCheck.current) return
    didCheck.current = true

    if (hasAuthCookie()) {
      router.replace("/dashboard")
    } else {
      // No session cookie — expired or signed out elsewhere; drop the cached profile
      localStorage.removeItem("pilotphd_user")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      if (tab === "signup") {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || "Registration failed.")
        setSuccess(data.message)
      } else {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: form.email, password: form.password }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || "Sign in failed.")
        // The JWT deliberately stays out of localStorage: the HttpOnly session
        // cookie already authenticates us, and a readable copy would hand any
        // XSS a 7-day token. Only the display profile is cached.
        localStorage.setItem("pilotphd_user", JSON.stringify(data.user))
        setAuthCookie()
        window.dispatchEvent(new StorageEvent("storage", { key: "pilotphd_user", newValue: JSON.stringify(data.user) }))
        router.push("/dashboard")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#fafafa] flex flex-col overflow-auto">
      {/* Minimal nav */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md shrink-0">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">P</span>
            <span className="font-semibold text-gray-900 text-sm">PilotPhD</span>
          </Link>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            ← Back to home
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">P</div>
            <h1 className="text-xl font-semibold text-gray-900">
              {tab === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-gray-400">
              {tab === "signin" ? "Sign in to continue to PilotPhD" : "Start organizing your PhD applications"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); setSuccess("") }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* Success banner (shown after sign up) */}
          {success && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-3 mb-4 space-y-1">
              <p className="text-sm font-medium text-green-700">Check your inbox</p>
              <p className="text-xs text-green-600">{success}</p>
            </div>
          )}

          {/* Form */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</label>
                  <input type="text" placeholder="Alex Chen" value={form.name} onChange={setField("name")} className={inputClass} autoFocus required />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
                <input type="email" placeholder="you@university.edu" value={form.email} onChange={setField("email")} className={inputClass} autoFocus={tab === "signin"} required />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Password</label>
                  {tab === "signin" && (
                    <Link href="/forgot-password" className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={setField("password")}
                    className={inputClass}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-red-600">{error}</p>
                  {error.includes("verify your email") && (
                    <Link href="/resend-verification" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                      Resend verification email →
                    </Link>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {loading
                  ? (tab === "signin" ? "Signing in…" : "Creating account…")
                  : (tab === "signin" ? "Sign in" : "Create account")}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              {tab === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => { setTab(tab === "signin" ? "signup" : "signin"); setError(""); setSuccess("") }}
                className="text-blue-500 hover:text-blue-700 transition-colors font-medium"
              >
                {tab === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
