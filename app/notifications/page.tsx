"use client"

import { useState, useEffect } from "react"
import { Bell, Check, CheckCheck, Package, ShoppingCart, AlertTriangle, Info, Trash2, Loader2 } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const { t } = useLanguage()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    if (data) setNotifications(data)
    setLoading(false)
  }

  const markAsRead = async (id: string) => {
    const supabase = createClient()
    await supabase.from("notifications").update({ read: true }).eq("id", id)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const deleteNotification = async (id: string) => {
    const supabase = createClient()
    await supabase.from("notifications").delete().eq("id", id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "order": return <ShoppingCart className="w-4 h-4 text-blue-500" />
      case "listing": return <Package className="w-4 h-4 text-emerald-500" />
      case "alert": return <AlertTriangle className="w-4 h-4 text-amber-500" />
      default: return <Info className="w-4 h-4 text-stone-400" />
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "Just now"
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHrs = Math.floor(diffMin / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="flex h-screen bg-[#FBFBF9]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 border-b border-stone-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-stone-600" />
            <h1 className="text-lg font-semibold text-stone-900">{t("notifications")}</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t("mark_all_read")}
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-stone-300" />
              </div>
              <p className="text-sm text-stone-500">{t("no_notifications")}</p>
              <p className="text-xs text-stone-400 mt-1">Notifications will appear here when you list products or receive orders</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto divide-y divide-stone-100">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "flex items-start gap-3 px-4 md:px-6 py-4 hover:bg-white transition-colors cursor-pointer",
                    !notif.read && "bg-stone-50/80"
                  )}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm", !notif.read ? "font-medium text-stone-900" : "text-stone-700")}>{notif.title}</p>
                      {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-stone-400 mt-1">{formatTime(notif.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id) }}
                    className="p-1 text-stone-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <MobileNav />
      </div>
    </div>
  )
}
