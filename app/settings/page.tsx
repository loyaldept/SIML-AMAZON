"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CreditCard, Shield, FileText, HelpCircle, LogOut, ChevronRight,
  Bell, Globe, Moon, Save, Check, Link2, Unlink, Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { createClient } from "@/lib/supabase/client"
import { useLanguage, type Language } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface ChannelConn {
  id: string
  channel: string
  status: string
  store_name: string | null
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const amazonConnected = searchParams.get("amazon") === "connected"
  const { lang, setLang, t, langNames } = useLanguage()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    full_name: "", email: "", company: "", phone: "", timezone: "",
  })
  const [preferences, setPreferences] = useState({
    emailNotifications: true, pushNotifications: false, darkMode: false, autoSync: true,
  })
  const [channels, setChannels] = useState<ChannelConn[]>([])
  const [connecting, setConnecting] = useState("")

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }

      // Load profile
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (p) {
        setProfile({
          full_name: p.full_name || user.user_metadata?.full_name || "",
          email: user.email || "",
          company: p.company || "",
          phone: p.phone || "",
          timezone: p.timezone || "",
        })
        if (p.language) setLang(p.language as Language)
      } else {
        setProfile({
          full_name: user.user_metadata?.full_name || "",
          email: user.email || "",
          company: "", phone: "", timezone: "",
        })
      }

      // Load channels
      const { data: ch } = await supabase.from("channel_connections").select("*").eq("user_id", user.id)
      if (ch) setChannels(ch)
    }
    load()
  }, [router, setLang])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.full_name,
      company: profile.company,
      phone: profile.phone,
      timezone: profile.timezone,
      language: lang,
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleConnect = async (channel: string) => {
    setConnecting(channel)

    if (channel === "Amazon") {
      // Redirect to Amazon OAuth flow
      window.location.href = "/api/amazon/auth"
      return
    }

    // For eBay and Shopify - placeholder connect (save to DB for future OAuth)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("channel_connections").upsert({
      user_id: user.id, channel, status: "connected", store_name: `My ${channel} Store`,
    }, { onConflict: "user_id,channel" })

    const { data: ch } = await supabase.from("channel_connections").select("*").eq("user_id", user.id)
    if (ch) setChannels(ch)
    setConnecting("")
  }

  const handleDisconnect = async (channel: string, id: string) => {
    const supabase = createClient()

    if (channel === "Amazon") {
      // Use the Amazon disconnect API to clear tokens
      await fetch("/api/amazon/status", { method: "DELETE" })
    }

    await supabase.from("channel_connections").update({ status: "disconnected", access_token: null, refresh_token: null }).eq("id", id)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: ch } = await supabase.from("channel_connections").select("*").eq("user_id", user.id)
      if (ch) setChannels(ch)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const handleLanguageChange = async (l: Language) => {
    setLang(l)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("profiles").upsert({ id: user.id, language: l })
    }
  }

  const channelConfigs = [
    { name: "Amazon", desc: "Amazon Seller Central" },
    { name: "eBay", desc: "eBay Seller Account" },
    { name: "Shopify", desc: "Shopify Storefront" },
  ]

  const getChannelConn = (name: string) => channels.find((c) => c.channel === name)

  return (
    <div className="flex h-screen bg-[#FBFBF9]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
            {/* Amazon connection success */}
            {amazonConnected && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <Check className="w-4 h-4 text-emerald-600" />
                <p className="text-sm text-emerald-800 font-medium">Amazon Seller account connected successfully!</p>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-stone-900">{t("settings")}</h1>
                <p className="text-sm text-stone-500 mt-0.5">Manage your account and preferences</p>
              </div>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saved ? "Saved" : saving ? "Saving..." : t("save")}
              </Button>
            </div>

            {/* Profile */}
            <Card className="border-stone-200/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-lg font-bold text-stone-700">
                    {profile.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
                  </div>
                  <div>
                    <CardTitle className="text-base">{t("profile")}</CardTitle>
                    <CardDescription className="text-xs">Update your personal details</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-600">Full Name</Label>
                    <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-600">Email</Label>
                    <Input value={profile.email} disabled className="h-9 text-sm bg-stone-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-600">Company</Label>
                    <Input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-stone-600">Phone</Label>
                    <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="h-9 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Channel Connections */}
            <Card className="border-stone-200/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">{t("channels")}</CardTitle>
                <CardDescription className="text-xs">Connect your marketplace accounts for syncing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {channelConfigs.map((ch) => {
                  const conn = getChannelConn(ch.name)
                  const isConnected = conn?.status === "connected"
                  return (
                    <div key={ch.name} className="flex items-center justify-between py-3 px-4 rounded-lg border border-stone-200 bg-white">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          isConnected ? "bg-emerald-500" : "bg-stone-300"
                        )} />
                        <div>
                          <p className="text-sm font-medium text-stone-900">{ch.name}</p>
                          <p className="text-xs text-stone-500">{isConnected ? conn?.store_name || t("connected") : ch.desc}</p>
                        </div>
                      </div>
                      {isConnected ? (
                        <button
                          onClick={() => conn && handleDisconnect(ch.name, conn.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Unlink className="w-3 h-3" />
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(ch.name)}
                          disabled={connecting === ch.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition-colors"
                        >
                          {connecting === ch.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                          {t("connect")}
                        </button>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Language */}
            <Card className="border-stone-200/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-stone-500" />
                  {t("language")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(langNames) as Language[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => handleLanguageChange(l)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                        lang === l
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                      )}
                    >
                      {langNames[l]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card className="border-stone-200/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-stone-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Email Notifications</p>
                      <p className="text-xs text-stone-500">Receive updates via email</p>
                    </div>
                  </div>
                  <Switch checked={preferences.emailNotifications} onCheckedChange={(c) => setPreferences({ ...preferences, emailNotifications: c })} />
                </div>
                <Separator className="bg-stone-100" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-stone-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Push Notifications</p>
                      <p className="text-xs text-stone-500">Get notified on your device</p>
                    </div>
                  </div>
                  <Switch checked={preferences.pushNotifications} onCheckedChange={(c) => setPreferences({ ...preferences, pushNotifications: c })} />
                </div>
                <Separator className="bg-stone-100" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-stone-500" />
                    <div>
                      <p className="text-sm font-medium text-stone-900">Auto Sync</p>
                      <p className="text-xs text-stone-500">Automatically sync inventory across channels</p>
                    </div>
                  </div>
                  <Switch checked={preferences.autoSync} onCheckedChange={(c) => setPreferences({ ...preferences, autoSync: c })} />
                </div>
              </CardContent>
            </Card>

            {/* Legal */}
            <Card className="border-stone-200/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Legal & Support</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {[
                  { icon: CreditCard, label: t("billing") },
                  { icon: Shield, label: t("privacy") },
                  { icon: FileText, label: t("terms") },
                  { icon: HelpCircle, label: t("help") },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <button key={item.label} className="w-full flex items-center justify-between px-6 py-3 hover:bg-stone-50 transition-colors text-left">
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-stone-500" />
                        <span className="text-sm text-stone-700">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            {/* Logout */}
            <Button
              variant="outline"
              className="w-full justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 bg-transparent"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              {t("logout")}
            </Button>

            <p className="text-center text-xs text-stone-400">Siml Listing v1.0.0</p>
          </div>
        </div>
        <MobileNav />
      </div>
    </div>
  )
}
