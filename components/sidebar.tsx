"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard, ListPlus, Package, Truck, DollarSign, Settings,
  Plus, RefreshCw, MessageSquare, LogOut, Globe, Bell
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useLanguage, type Language } from "@/lib/i18n"

interface ChannelConnection {
  id: string
  channel: string
  status: string
  store_name: string | null
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang, t, langNames } = useLanguage()
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null)
  const [channels, setChannels] = useState<ChannelConnection[]>([])
  const [showLang, setShowLang] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        setUser({ email: u.email, full_name: u.user_metadata?.full_name })
        const { data: ch } = await supabase.from("channel_connections").select("*").eq("user_id", u.id)
        if (ch) setChannels(ch)
        const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", u.id).eq("read", false)
        setUnreadCount(count || 0)
      }
    }
    load()
  }, [])

  const [connecting, setConnecting] = useState("")

  const handleConnect = async (channel: string) => {
    if (channel === "Amazon") {
      // Redirect to Amazon Seller Central OAuth authorization
      window.location.href = "/api/amazon/auth"
      return
    }
    // eBay/Shopify placeholder - go to settings
    router.push("/settings")
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const mainNav = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { href: "/chat", icon: MessageSquare, label: t("chat") },
    { href: "/list", icon: ListPlus, label: t("list") },
    { href: "/inventory", icon: Package, label: t("inventory") },
    { href: "/shipments", icon: Truck, label: t("shipments") },
    { href: "/repricing", icon: DollarSign, label: t("repricing") },
  ]

  const channelConfigs = ["Amazon", "eBay", "Shopify"]
  const getChannelStatus = (ch: string) => {
    const conn = channels.find((c) => c.channel === ch)
    if (conn?.status === "connected") return "connected"
    return "disconnected"
  }
  const initials = user?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"

  return (
    <aside className="w-64 bg-[#F7F6F3] border-r border-stone-200/60 hidden md:flex flex-col h-full shrink-0 z-30">
      {/* Brand */}
      <div className="h-16 flex items-center px-5 sticky top-0 bg-[#F7F6F3]/80 backdrop-blur z-10">
        <Link href="/dashboard" className="flex items-center gap-2 text-stone-900 group cursor-pointer">
          <img src="/favicon.png" alt="Siml" className="w-6 h-6 rounded-md" />
          <span className="font-semibold tracking-tight text-sm">Siml Listing</span>
        </Link>
      </div>

      {/* Primary Actions */}
      <div className="px-3 pb-4">
        <Link href="/list">
          <Button className="w-full justify-center gap-2 mb-2">
            <Plus className="w-4 h-4" />
            <span>{t("create_listing")}</span>
          </Button>
        </Link>
        <Button variant="outline" className="w-full justify-center gap-2 bg-transparent">
          <RefreshCw className="w-4 h-4" />
          <span>{t("sync")}</span>
        </Button>
      </div>

      {/* Scrollable Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-6">
        <div className="space-y-0.5">
          {mainNav.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all",
                  isActive
                    ? "text-stone-900 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] font-medium"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100",
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-stone-600" : "text-stone-400")} />
                {item.label}
                {item.href === "/chat" && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
                )}
              </Link>
            )
          })}

          {/* Notifications */}
          <Link
            href="/notifications"
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all",
              pathname === "/notifications"
                ? "text-stone-900 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] font-medium"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100",
            )}
          >
            <Bell className={cn("w-4 h-4", pathname === "/notifications" ? "text-stone-600" : "text-stone-400")} />
            {t("notifications")}
            {unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
            )}
          </Link>
        </div>

        {/* Channels */}
        <div>
          <div className="px-3 mb-2">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">{t("channels")}</span>
          </div>
          <div className="space-y-0.5">
            {channelConfigs.map((channel) => {
              const status = getChannelStatus(channel)
              return (
                <div key={channel} className="flex items-center gap-2.5 px-3 py-2 text-sm text-stone-600">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      status === "connected" || status === "syncing" ? "bg-emerald-500" : "bg-stone-300",
                    )}
                  />
                  <span className="flex-1">{channel}</span>
                  {status === "connected" && (
                    <span className="text-[10px] text-emerald-600 font-medium">{t("connected")}</span>
                  )}
                  {status === "syncing" && (
                    <span className="text-[10px] text-stone-400 font-mono">{t("syncing")}</span>
                  )}
                  {status === "disconnected" && (
                    <button
                      onClick={() => handleConnect(channel)}
                      disabled={connecting === channel}
                      className="text-[10px] text-stone-900 font-medium bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                    >
                      {connecting === channel ? "Connecting..." : t("connect")}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Language Selector */}
        <div>
          <button
            onClick={() => setShowLang(!showLang)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all w-full"
          >
            <Globe className="w-4 h-4 text-stone-400" />
            {t("language")}: {langNames[lang]}
          </button>
          {showLang && (
            <div className="ml-6 mt-1 space-y-0.5">
              {(Object.keys(langNames) as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => { setLang(l); setShowLang(false) }}
                  className={cn(
                    "block w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors",
                    lang === l ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
                  )}
                >
                  {langNames[l]}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* User + Settings */}
      <div className="mt-auto pt-4 px-3 pb-4 space-y-1">
        <Link
          href="/settings"
          className="w-full flex items-center gap-3 px-2 py-2 hover:bg-white hover:shadow-sm rounded-xl border border-transparent hover:border-stone-200/60 transition-all text-left"
        >
          <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-xs font-bold text-stone-700">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-stone-900 truncate">{user?.full_name || "User"}</div>
            <div className="text-xs text-stone-500 truncate">{user?.email}</div>
          </div>
          <Settings className="w-4 h-4 text-stone-400" />
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut className="w-4 h-4" />
          {t("logout")}
        </button>
      </div>
    </aside>
  )
}
