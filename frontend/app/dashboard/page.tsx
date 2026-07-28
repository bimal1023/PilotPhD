"use client"

import { API_URL } from "@/lib/api"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { fetchApplicationsCached } from "@/lib/applicationsCache"

type Application = { id: number; university: string; program: string; status: string }

// Status reads as a printed mark — a small square plus a word, not a pill.
const statusConfig: Record<string, { text: string; mark: string }> = {
  planning:  { text: "text-ink-faint", mark: "bg-ink-faint" },
  applied:   { text: "text-slate",     mark: "bg-slate" },
  waiting:   { text: "text-ochre",     mark: "bg-ochre" },
  accepted:  { text: "text-sage",      mark: "bg-sage" },
  rejected:  { text: "text-accent",    mark: "bg-accent" },
  withdrawn: { text: "text-ink-faint", mark: "bg-rule-strong" },
}

const tools = [
  {
    href: "/professors",
    label: "Find Professors",
    description: "Discover researchers whose work aligns with yours",
  },
  {
    href: "/email",
    label: "Draft Email",
    description: "Write a personalized cold email to a professor",
  },
  {
    href: "/statement",
    label: "Refine Statement",
    description: "Get expert feedback on your personal statement",
  },
  {
    href: "/fellowships",
    label: "Find Fellowships",
    description: "Discover funding opportunities for your research",
  },
  {
    href: "/briefing",
    label: "Daily Briefing",
    description: "Get your personalized morning summary",
  },
]

export default function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([])
  const [userName, setUserName] = useState("")
  const didLoad = useRef(false)

  useEffect(() => {
    if (didLoad.current) return
    didLoad.current = true

    async function load() {
      const stored = localStorage.getItem("pilotphd_user")
      if (stored) {
        try { setUserName(JSON.parse(stored).name?.split(" ")[0] ?? "") } catch {}
      }
      try {
        const data = await fetchApplicationsCached(async () => {
          const res = await fetchWithTimeout(`${API_URL}/api/applications/`)
          const json = await res.json()
          return Array.isArray(json) ? json : []
        })
        setApplications(data)
      } catch {}
    }
    load()
  }, [])

  const total     = applications.length
  const submitted = applications.filter((a) => a.status === "applied").length
  const waiting   = applications.filter((a) => a.status === "waiting").length
  const accepted  = applications.filter((a) => a.status === "accepted").length

  const stats = [
    { label: "Total",     value: total,     sub: "applications" },
    { label: "Submitted", value: submitted, sub: "sent" },
    { label: "Waiting",   value: waiting,   sub: "in review" },
    { label: "Accepted",  value: accepted,  sub: "offers" },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <div>
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <header className="rise">
        <h1 className="font-display text-[2.75rem] md:text-[4rem] leading-[0.95] font-semibold text-ink">
          {greeting}
          {userName ? (
            <>
              ,<br className="hidden md:block" />
              <span className="text-accent"> {userName}</span>
            </>
          ) : ""}
        </h1>
        <div
          className="h-px bg-rule-strong mt-7 rule-draw"
          style={{ animationDelay: "0.15s" }}
        />
        <p className="label text-ink-faint mt-3">
          {today} <span className="text-rule-strong mx-1.5">/</span> Application overview
        </p>
      </header>

      {/* ── Ledger ───────────────────────────────────────────────── */}
      <section
        className="mt-12 grid grid-cols-2 md:grid-cols-4 border-t border-rule rise"
        style={{ animationDelay: "0.1s" }}
      >
        {stats.map((stat, i) => (
          <Link
            key={stat.label}
            href="/applications"
            className={`group py-6 md:py-7 border-b border-rule transition-colors hover:bg-paper-raised
              ${i % 2 === 0 ? "pr-5" : "pl-5 md:pl-6"}
              ${i > 0 ? "md:border-l md:border-rule md:pl-6" : ""}
              ${i % 2 === 1 ? "border-l border-rule" : ""}`}
          >
            <p className="label text-ink-faint">{stat.label}</p>
            <p className="font-display tnum text-[3.25rem] leading-none font-semibold text-ink mt-2.5 transition-colors group-hover:text-accent">
              {String(stat.value).padStart(2, "0")}
            </p>
            <p className="text-[0.8125rem] text-ink-soft mt-2">{stat.sub}</p>
          </Link>
        ))}
      </section>

      {/* ── Recent applications ──────────────────────────────────── */}
      {applications.length > 0 && (
        <section className="mt-16 rise" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-baseline justify-between border-b border-rule-strong pb-2.5">
            <h2 className="label text-ink">Recent Applications</h2>
            <Link
              href="/applications"
              className="label text-ink-faint hover:text-accent transition-colors"
            >
              View all →
            </Link>
          </div>

          <ul>
            {applications.slice(0, 3).map((app, i) => {
              const status = statusConfig[app.status] ?? statusConfig.planning
              return (
                <li key={app.id}>
                  <Link
                    href="/applications"
                    className="entry flex items-baseline gap-4 md:gap-6 py-5 border-b border-rule -mx-3 px-3"
                  >
                    <span className="entry-num label tnum text-ink-faint shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-display text-xl md:text-[1.4rem] text-ink leading-tight truncate">
                        {app.university}
                      </span>
                      <span className="block text-sm text-ink-soft mt-1 truncate">
                        {app.program}
                      </span>
                    </span>
                    <span className={`label flex items-center gap-2 shrink-0 ${status.text}`}>
                      <span className={`w-1.5 h-1.5 ${status.mark}`} />
                      {app.status}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ── Tools, set as a table of contents ────────────────────── */}
      <section className="mt-16 rise" style={{ animationDelay: "0.3s" }}>
        <h2 className="label text-ink border-b border-rule-strong pb-2.5">Tools</h2>
        <ul>
          {tools.map((tool, i) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                prefetch={false}
                className="entry group flex items-baseline gap-4 md:gap-6 py-5 border-b border-rule -mx-3 px-3"
              >
                <span className="entry-num label tnum text-ink-faint shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display text-xl md:text-[1.4rem] text-ink leading-tight transition-colors group-hover:text-accent">
                    {tool.label}
                  </span>
                  <span className="block text-sm text-ink-soft mt-1">
                    {tool.description}
                  </span>
                </span>
                <span className="text-ink-faint shrink-0 transition-all duration-300 group-hover:text-accent group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
