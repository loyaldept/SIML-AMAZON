"use client"

import React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.png" alt="Siml" className="h-16 w-16 rounded-xl mb-4" />
          <h1 className="text-2xl font-serif text-stone-900">Welcome back</h1>
          <p className="text-sm text-stone-500 mt-1">Sign in to your Siml account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
            <label className="text-xs text-stone-500 block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              placeholder="Your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-stone-500 mt-6">
          {"Don't have an account? "}
          <Link href="/auth/sign-up" className="text-stone-900 font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
