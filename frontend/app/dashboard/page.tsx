"use client"

import { API_URL } from "@/lib/api"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { fetchApplicationsCached } from "@/lib/applicationsCache"

type Application = { id: number; university: string; program: string; status: string }

const statusConfig: Record<string, { color: string; dot: string }> = {
  planning:  { color: "bg-gray-100 text-gray-600",    dot: "bg-gray-400" },
  applied:   { color: "bg-blue-50 text-blue-600",     dot: "bg-blue-500" },
  waiting:   { color: "bg-amber-50 text-amber-600",   dot: "bg-amber-400" },
  accepted:  { color: "bg-green-50 text-green-600",   dot: "bg-green-500" },
  rejected:  { color: "bg-red-50 text-red-500",       dot: "bg-red-400" },
  withdrawn: { color: "bg-orange-50 text-orange-500", dot: "bg-orange-400" },
}

const quickActions = [
  {
    href: "/professors",
    label: "Find Professors",
    description: "Discover researchers whose work aligns with yours",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="#2563eb" strokeWidth="1.2"/>
        <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M11 2.5a2 2 0 010 4M14 13c0-1.8-1.2-3-3-3.5" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/email",
    label: "Draft Email",
    description: "Write a personalized cold email to a professor",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3.5h12a.5.5 0 01.5.5v8a.5.5 0 01-.5.5H2a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z" stroke="#2563eb" strokeWidth="1.2"/>
        <path d="M1.5 4l6.5 4.5L14.5 4" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/statement",
    label: "Refine Statement",
    description: "Get expert feedback on your personal statement",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="#2563eb" strokeWidth="1.2"/>
        <path d="M5 5.5h6M5 8h4M5 10.5h3" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/fellowships",
    label: "Find Fellowships",
    description: "Discover funding opportunities for your research",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5l1.6 3.2 3.5.5-2.5 2.5.6 3.5L8 9.5l-3.2 1.7.6-3.5L3 5.2l3.5-.5L8 1.5z" stroke="#2563eb" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/briefing",
    label: "Daily Briefing",
    description: "Get your personalized morning summary",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="#2563eb" strokeWidth="1.2"/>
        <path d="M8 4.5v3.5l2 2" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
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
    { label: "Submitted", value: submitted,  sub: "sent" },
    { label: "Waiting",   value: waiting,    sub: "in review" },
    { label: "Accepted",  value: accepted,   sub: "offers" },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting}{userName ? `, ${userName}` : ""}
        </h1>
        <p className="text-sm text-gray-400">{today} · Here&apos;s your PhD application overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href="/applications"
            className="bg-white rounded-xl border border-gray-100 p-5 hover:border-gray-200 transition-all group"
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
          </Link>
        ))}
      </div>

      {applications.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent Applications</p>
            <Link href="/applications" className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {applications.slice(0, 3).map((app) => (
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center justify-between hover:border-gray-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${statusConfig[app.status]?.dot ?? "bg-gray-300"}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{app.university}</p>
                    <p className="text-xs text-gray-400">{app.program}</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusConfig[app.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Tools</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              prefetch={false}
              className="group bg-white rounded-xl border border-gray-100 p-5 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5">{action.icon}</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors">{action.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
