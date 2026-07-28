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

function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-baseline gap-2.5 shrink-0 group">
      <span className="w-[3px] h-5 bg-accent self-center transition-transform duration-300 group-hover:scale-y-125" />
      <span className="font-display text-[19px] font-semibold text-ink leading-none">
        PilotPhD
      </span>
    </Link>
  )
}

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
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" />
      <div
        className="absolute top-[65px] left-0 right-0 bg-paper border-y border-rule shadow-[0_18px_40px_-20px_rgba(23,21,15,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="px-5 py-3">
          {user ? (
            <>
              {navLinks.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  prefetch={false}
                  className={`flex items-baseline gap-4 py-3 border-b border-rule/70 transition-colors ${
                    pathname === link.href ? "text-accent" : "text-ink hover:text-accent"
                  }`}
                >
                  <span className="label tnum text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-lg">{link.label}</span>
                </Link>
              ))}
              <button
                onClick={() => { onSignOut(); onClose() }}
                className="label text-ink-faint hover:text-accent transition-colors pt-4 pb-1"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onClose}
                className="block py-3 border-b border-rule/70 font-display text-lg text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                onClick={onClose}
                className="block py-3 font-display text-lg text-accent"
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
      <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-rule">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-6">
          <Wordmark href={user ? "/dashboard" : "/"} />

          {/* Desktop nav — only when authenticated and off the landing page */}
          {showAppNav && (
            <nav className="hidden md:flex items-center gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  data-active={pathname === link.href}
                  className={`nav-link label transition-colors ${
                    pathname === link.href
                      ? "text-ink"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side — held until mounted to avoid an SSR/hydration flash */}
          <div className="flex items-center gap-4 shrink-0">
            {mounted && user ? (
              <>
                <span className="hidden md:block label text-ink-faint">{user.name}</span>
                <span className="hidden md:block w-px h-3.5 bg-rule-strong" />
                <button
                  onClick={signOut}
                  className="hidden md:block label text-ink-faint hover:text-accent transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : mounted ? (
              <>
                <Link
                  href="/login"
                  className="hidden md:block label text-ink-soft hover:text-ink transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="hidden md:block label text-paper bg-accent hover:bg-ink transition-colors px-3.5 py-2"
                >
                  Sign up
                </Link>
              </>
            ) : (
              <div className="hidden md:block w-28 h-5" /> /* placeholder holds layout */
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-8 h-8 -mr-1 flex items-center justify-center text-ink-soft hover:text-accent transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4.5h12M2 8h12M2 11.5h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
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
