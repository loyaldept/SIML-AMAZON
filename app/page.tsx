"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      const { data: profile } = await supabase.from("profiles").select("onboarding_complete").eq("id", user.id).single()
      if (profile?.onboarding_complete) {
        router.push("/dashboard")
      } else {
        router.push("/onboarding")
      }
    }
    check()
  }, [router])

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
    </div>
  )
}
