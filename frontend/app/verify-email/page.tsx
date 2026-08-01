"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { API_URL } from "@/lib/api"
import { setAuthCookie } from "@/lib/authCookie"
import { Suspense } from "react"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    async function verify() {
      if (!token) {
        setStatus("error")
        setMessage("No verification token found. Please use the link from your email.")
        return
      }
      try {
        const res = await fetch(`${API_URL}/api/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || "Verification failed.")
        localStorage.setItem("pilotphd_user", JSON.stringify(data.user))
        setAuthCookie()
        window.dispatchEvent(new StorageEvent("storage", { key: "pilotphd_user", newValue: JSON.stringify(data.user) }))
        setStatus("success")
        setTimeout(() => router.push("/dashboard"), 2000)
      } catch (err) {
        setStatus("error")
        setMessage(err instanceof Error ? err.message : "Verification failed.")
      }
    }
    verify()
  }, [token, router])

  return (
    <div className="fixed inset-0 z-50 bg-[#fafafa] flex flex-col">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md shrink-0">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">P</span>
            <span className="font-semibold text-gray-900 text-sm">PilotPhD</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          {status === "loading" && (
            <>
              <div className="w-12 h-12 border-2 border-gray-100 border-t-blue-500 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Verifying your email…</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Email verified!</h1>
                <p className="text-sm text-gray-400 mt-1">Redirecting you to your dashboard…</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Verification failed</h1>
                <p className="text-sm text-gray-400 mt-1">{message}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-all text-center"
                >
                  Back to sign in
                </Link>
                <Link
                  href="/resend-verification"
                  className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all text-center"
                >
                  Resend verification email
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-[#fafafa]">
    <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
  </div>
)

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
