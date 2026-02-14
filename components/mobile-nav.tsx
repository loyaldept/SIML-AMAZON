"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ListPlus, Package, MessageSquare, Settings, Bell } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { href: "/chat", icon: MessageSquare, label: "Chat" },
    { href: "/list", icon: ListPlus, label: "List" },
    { href: "/inventory", icon: Package, label: "Inventory" },
    { href: "/notifications", icon: Bell, label: "Alerts" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50 md:hidden safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-2 rounded-lg transition-colors min-w-14",
                isActive ? "text-stone-900" : "text-stone-500 hover:text-stone-700",
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn("text-[10px] mt-1", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
