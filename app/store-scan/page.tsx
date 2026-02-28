"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  Activity,
  Package,
  AlertTriangle,
  TrendingUp,
  Shield,
  Check,
  Loader2,
  Sparkles,
  Heart,
  BarChart3,
  ArrowRight,
} from "lucide-react"

interface ScanStep {
  id: string
  label: string
  icon: React.ElementType
  status: "pending" | "scanning" | "done" | "warning"
  detail?: string
  stats?: Record<string, string | number>
}

export default function StoreScanPage() {
  const router = useRouter()
  const [scanSteps, setScanSteps] = useState<ScanStep[]>([
    { id: "connection", label: "Verifying store connection", icon: Shield, status: "pending" },
    { id: "health", label: "Scanning account health", icon: Heart, status: "pending" },
    { id: "inventory", label: "Analyzing inventory levels", icon: Package, status: "pending" },
    { id: "alerts", label: "Checking for stock alerts", icon: AlertTriangle, status: "pending" },
    { id: "performance", label: "Reviewing sales performance", icon: BarChart3, status: "pending" },
    { id: "recommendations", label: "Generating recommendations", icon: TrendingUp, status: "pending" },
  ])
  const [overallProgress, setOverallProgress] = useState(0)
  const [scanComplete, setScanComplete] = useState(false)
  const [scanResults, setScanResults] = useState<any>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    startScan()
  }, [])

  const updateStep = (id: string, updates: Partial<ScanStep>) => {
    setScanSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  const startScan = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
      return
    }

    // Step 1: Verify connection
    updateStep("connection", { status: "scanning" })
    setOverallProgress(5)
    await delay(800)

    const { data: channels } = await supabase
      .from("channel_connections")
      .select("channel, status")
      .eq("user_id", user.id)
      .eq("status", "connected")

    const connected = channels && channels.length > 0
    updateStep("connection", {
      status: "done",
      detail: connected
        ? `${channels!.map((c) => c.channel).join(", ")} connected`
        : "No stores connected",
    })
    setOverallProgress(15)

    if (!connected) {
      // Skip rest of scan if nothing connected
      setScanSteps((prev) =>
        prev.map((s) =>
          s.id !== "connection"
            ? { ...s, status: "done", detail: "Skipped - no store connected" }
            : s
        )
      )
      setOverallProgress(100)
      setScanComplete(true)
      return
    }

    // Step 2: Account health
    updateStep("health", { status: "scanning" })
    setOverallProgress(25)
    await delay(1200)

    try {
      const res = await fetch("/api/store-scan")
      const data = await res.json()
      setScanResults(data)

      updateStep("health", {
        status: "done",
        detail: data.health?.status || "Account in good standing",
        stats: data.health?.stats,
      })
      setOverallProgress(40)

      // Step 3: Inventory analysis
      updateStep("inventory", { status: "scanning" })
      await delay(1000)
      updateStep("inventory", {
        status: data.inventory?.totalItems > 0 ? "done" : "warning",
        detail: data.inventory?.totalItems > 0
          ? `${data.inventory.totalItems} products, ${data.inventory.totalUnits} units`
          : "No inventory data found",
        stats: {
          "Total SKUs": data.inventory?.totalItems || 0,
          "Total Units": data.inventory?.totalUnits || 0,
          "Est. Value": `$${(data.inventory?.totalValue || 0).toFixed(2)}`,
        },
      })
      setOverallProgress(55)

      // Step 4: Stock alerts
      updateStep("alerts", { status: "scanning" })
      await delay(900)
      const alertCount =
        (data.alerts?.lowStock || 0) + (data.alerts?.outOfStock || 0)
      updateStep("alerts", {
        status: alertCount > 0 ? "warning" : "done",
        detail:
          alertCount > 0
            ? `${data.alerts.outOfStock} out of stock, ${data.alerts.lowStock} low stock`
            : "All stock levels healthy",
        stats: {
          "Out of Stock": data.alerts?.outOfStock || 0,
          "Low Stock": data.alerts?.lowStock || 0,
          Healthy: data.alerts?.healthy || 0,
        },
      })
      setOverallProgress(70)

      // Step 5: Sales performance
      updateStep("performance", { status: "scanning" })
      await delay(1100)
      updateStep("performance", {
        status: "done",
        detail: data.performance?.totalOrders > 0
          ? `${data.performance.totalOrders} orders, $${(data.performance.totalRevenue || 0).toFixed(2)} revenue`
          : "No sales data yet",
        stats: {
          "Total Orders": data.performance?.totalOrders || 0,
          Revenue: `$${(data.performance?.totalRevenue || 0).toFixed(2)}`,
          "Avg Order": `$${(data.performance?.avgOrderValue || 0).toFixed(2)}`,
        },
      })
      setOverallProgress(85)

      // Step 6: Recommendations
      updateStep("recommendations", { status: "scanning" })
      await delay(1300)
      updateStep("recommendations", {
        status: "done",
        detail: data.recommendations?.length > 0
          ? `${data.recommendations.length} recommendations generated`
          : "Analysis complete",
      })
      setOverallProgress(100)
    } catch (e: any) {
      setError(e.message || "Scan failed")
      // Mark remaining steps as done with error
      setScanSteps((prev) =>
        prev.map((s) =>
          s.status === "pending" || s.status === "scanning"
            ? { ...s, status: "done", detail: "Scan completed with limited data" }
            : s
        )
      )
      setOverallProgress(100)
    }

    setScanComplete(true)
  }

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const handleContinue = () => {
    router.push("/dashboard")
  }

  const handleGoToChat = () => {
    router.push("/chat")
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center gap-2">
        <img src="/favicon.png" alt="Siml" className="w-7 h-7 rounded-md" />
        <span className="font-serif text-xl text-stone-900">Siml</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center mx-auto mb-6">
              <Activity className="w-8 h-8 text-white animate-pulse" />
            </div>
            <h1 className="font-serif text-3xl text-stone-900 mb-2">
              {scanComplete ? "Scan Complete" : "Scanning Your Store"}
            </h1>
            <p className="text-stone-500 text-sm">
              {scanComplete
                ? "Here's what we found. Head to your dashboard or chat to dive deeper."
                : "Analyzing your store health, inventory, and performance..."}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden mb-8">
            <div
              className="bg-stone-900 h-2 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {/* Scan Steps */}
          <div className="space-y-3 mb-8">
            {scanSteps.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition-all duration-300",
                    step.status === "scanning"
                      ? "bg-white border-stone-300 shadow-sm"
                      : step.status === "done"
                        ? "bg-white border-stone-200"
                        : step.status === "warning"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-stone-50 border-stone-100"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      step.status === "scanning"
                        ? "bg-stone-900"
                        : step.status === "done"
                          ? "bg-emerald-100"
                          : step.status === "warning"
                            ? "bg-amber-100"
                            : "bg-stone-100"
                    )}
                  >
                    {step.status === "scanning" ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : step.status === "done" ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : step.status === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Icon className="w-4 h-4 text-stone-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          step.status === "pending"
                            ? "text-stone-400"
                            : "text-stone-900"
                        )}
                      >
                        {step.label}
                      </span>
                      {step.status === "scanning" && (
                        <span className="text-[10px] text-stone-400 font-medium animate-pulse">
                          Scanning...
                        </span>
                      )}
                    </div>
                    {step.detail && (
                      <p
                        className={cn(
                          "text-xs mt-1",
                          step.status === "warning"
                            ? "text-amber-600"
                            : "text-stone-500"
                        )}
                      >
                        {step.detail}
                      </p>
                    )}
                    {step.stats && step.status !== "pending" && (
                      <div className="flex items-center gap-3 mt-2">
                        {Object.entries(step.stats).map(([key, val]) => (
                          <span
                            key={key}
                            className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-medium"
                          >
                            {key}: {val}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Recommendations Preview */}
          {scanComplete && scanResults?.recommendations?.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-stone-400" />
                <h3 className="text-sm font-semibold text-stone-900">
                  AI Recommendations
                </h3>
              </div>
              <div className="space-y-2">
                {scanResults.recommendations.slice(0, 3).map((rec: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-stone-600 py-1.5"
                  >
                    <TrendingUp className="w-3 h-3 text-stone-400 mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-xs text-amber-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          {scanComplete && (
            <div className="space-y-3">
              <button
                onClick={handleContinue}
                className="w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-stone-900 text-white hover:bg-stone-800 transition-all"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoToChat}
                className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask AI for deeper analysis
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
