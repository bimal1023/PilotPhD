"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { clearAuthCookie } from "@/lib/authCookie"

const navLinks = [
  { href: "/applications", label: "Applications" },
  { href: "/professors", label: "Professors" },
  { href: "/email", label: "Email" },
  { href: "/statement", label: "Statement" },
  { href: "/fellowships", label: "Fellowships" },
  { href: "/briefing", label: "Briefing" },
]

type User = { name: string; email: string }

function MobileMenu({
  open,
  onClose,
  user,
  onSignOut,
  pathname,
}: {
  open: boolean
  onClose: () => void
  user: User | null
  onSignOut: () => void
  pathname: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="absolute top-14 left-0 right-0 bg-white border-b border-gray-100 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="p-3 space-y-1">
          {user ? (
            <>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  prefetch={false}
                  className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                    pathname === link.href
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button
                  onClick={() => { onSignOut(); onClose() }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onClose}
                className="block px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-all"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                onClick={onClose}
                className="block px-3 py-2.5 rounded-lg text-sm bg-blue-600 text-white font-medium text-center hover:bg-blue-700 transition-all"
              >
                Sign up free
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  )
}

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pilotphd_user")
      if (stored) setUser(JSON.parse(stored) as User)
    } catch {}
    setMounted(true)
  }, [])

  // Listen for auth changes from other tabs or the login page
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "pilotphd_user") {
        try { setUser(e.newValue ? (JSON.parse(e.newValue) as User) : null) } catch {}
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  async function signOut() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {})
    localStorage.removeItem("pilotphd_token")
    localStorage.removeItem("pilotphd_user")
    clearAuthCookie()
    setUser(null)
    router.push("/")
  }

  const isLanding = pathname === "/"
  const showAppNav = user && !isLanding

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between relative">
          {/* Logo */}
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center gap-2 shrink-0"
          >
            <span className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              P
            </span>
            <span className="font-semibold text-gray-900 text-sm">PilotPhD</span>
          </Link>

          {/* Desktop nav — only when authenticated and not on landing */}
          {showAppNav && (
            <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    pathname === link.href
                      ? "text-gray-900 bg-gray-100 font-medium"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side — hidden until mounted to prevent SSR/hydration flash */}
          <div className="flex items-center gap-2">
            {mounted && user ? (
              <>
                <span className="hidden md:block text-xs text-gray-400">{user.name}</span>
                <button
                  onClick={signOut}
                  className="hidden md:flex text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
                >
                  Sign out
                </button>
              </>
            ) : mounted ? (
              <>
                <Link
                  href="/login"
                  className="hidden md:flex items-center text-xs text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="hidden md:flex items-center text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-all font-medium"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <div className="hidden md:block w-24 h-6" /> /* placeholder to hold layout */
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md transition-all"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 5h12M2 8h12M2 11h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        onSignOut={signOut}
        pathname={pathname}
      />
    </>
  )
}
