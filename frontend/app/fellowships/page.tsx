"use client"
import { API_URL } from "@/lib/api"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import LoadingCard from "@/components/LoadingCard"

export default function FellowshipFinder() {
  const [researchInterest, setResearchInterest] = useState("")
  const [profile, setProfile] = useState("")
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult("")
    setError("")

    try {
      const res = await fetchWithTimeout(`${API_URL}/api/agents/find-fellowships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research_interest: researchInterest, profile }),
      }, 180000) // up to 6 searches + a long list — well past the 60s default
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Something went wrong.")
      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Fellowship Finder</h1>
        <p className="text-sm text-gray-400">Discover funding opportunities matched to your research interests</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Research Interest</label>
          <input
            type="text"
            value={researchInterest}
            onChange={(e) => setResearchInterest(e.target.value)}
            placeholder="e.g. computational neuroscience, machine learning"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Your Profile</label>
          <textarea
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            placeholder="CS undergraduate, 3.9 GPA, one research paper published..."
            rows={4}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-all"
        >
          {loading ? "Searching fellowships..." : "Find Fellowships"}
        </button>
      </form>

      {loading && <LoadingCard message="Searching for fellowships..." />}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Fellowships Found</p>
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {result}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
