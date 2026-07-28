import { clearAuthCookie } from "./authCookie"

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 60000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const token = typeof window !== "undefined" ? localStorage.getItem("pilotphd_token") : null

  const headers = new Headers(options.headers as HeadersInit | undefined)
  if (token) headers.set("Authorization", `Bearer ${token}`)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      credentials: "include",
      headers,
    })
    clearTimeout(timeout)
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("pilotphd_token")
      localStorage.removeItem("pilotphd_user")
      clearAuthCookie()
      window.dispatchEvent(new StorageEvent("storage", { key: "pilotphd_user", newValue: null }))
      window.location.href = "/login"
    }
    return res
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out — this one takes a while. Please try again.")
    }
    throw new Error("Network error. Please check your connection and try again.")
  }
}
