"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Check, ChevronRight, Sparkles, Package, BarChart3, Truck, Tag, Link2, Clock, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  {
    id: 1,
    title: "Welcome to Siml",
    subtitle: "Your AI-powered e-commerce assistant",
    description: "Let's personalize your experience in just a few steps.",
  },
  {
    id: 2,
    title: "What do you sell?",
    subtitle: "Select your primary product categories",
    options: [
      { id: "books", label: "Books & Media" },
      { id: "electronics", label: "Electronics" },
      { id: "home", label: "Home & Kitchen" },
      { id: "toys", label: "Toys & Games" },
      { id: "clothing", label: "Clothing & Apparel" },
      { id: "health", label: "Health & Beauty" },
    ],
  },
  {
    id: 3,
    title: "Your business size",
    subtitle: "This helps us tailor recommendations",
    options: [
      { id: "starter", label: "Just Starting", desc: "< 50 products" },
      { id: "growing", label: "Growing", desc: "50-500 products" },
      { id: "established", label: "Established", desc: "500-2000 products" },
      { id: "enterprise", label: "Enterprise", desc: "2000+ products" },
    ],
  },
  {
    id: 4,
    title: "Which channels do you sell on?",
    subtitle: "Select all that apply",
    channels: [
      { id: "Amazon", label: "Amazon", color: "bg-orange-100 text-orange-700 border-orange-200" },
      { id: "eBay", label: "eBay", color: "bg-blue-100 text-blue-700 border-blue-200" },
      { id: "Shopify", label: "Shopify", color: "bg-green-100 text-green-700 border-green-200" },
    ],
  },
  {
    id: 5,
    title: "Key features for you",
    subtitle: "What matters most to your business?",
    features: [
      { id: "inventory", label: "Inventory Management", icon: Package, desc: "Track stock levels & restocking" },
      { id: "analytics", label: "Sales Analytics", icon: BarChart3, desc: "Revenue & profit insights" },
      { id: "shipments", label: "Shipment Tracking", icon: Truck, desc: "Fulfillment management" },
      { id: "repricing", label: "Smart Repricing", icon: Tag, desc: "Automated pricing rules" },
    ],
  },
  {
    id: 6,
    title: "Connect your store",
    subtitle: "Link your seller accounts to get started",
  },
]

const channelConfig: Record<string, { color: string; bgColor: string; borderColor: string; authPath: string; description: string }> = {
  Amazon: {
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    authPath: "/api/amazon/auth",
    description: "Connect your Amazon Seller Central account to sync inventory, orders, and analytics.",
  },
  eBay: {
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    authPath: "/api/ebay/auth",
    description: "Connect your eBay seller account to manage listings and track sales.",
  },
  Shopify: {
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    authPath: "/api/shopify/auth",
    description: "Connect your Shopify store to sync products and orders.",
  },
}

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [businessName, setBusinessName] = useState("")
  const [selections, setSelections] = useState<Record<string, string[]>>({
    categories: [],
    size: [],
    channels: [],
    features: [],
  })
  const [isAnimating, setIsAnimating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMsg, setLoadingMsg] = useState("")
  const [connectedChannels, setConnectedChannels] = useState<string[]>([])
  const [connectingChannel, setConnectingChannel] = useState<string | null>(null)

  const step = steps[currentStep]

  useEffect(() => {
    const checkOnboarding = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/auth/login"); return }
      const { data: profile } = await supabase.from("profiles").select("onboarding_complete, first_name").eq("id", user.id).single()
      if (profile?.onboarding_complete) {
        router.push("/dashboard")
      }
      if (profile?.first_name) setBusinessName(profile.first_name)
    }
    checkOnboarding()
  }, [router])

  const saveProfileAndChannels = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("profiles").update({
      business_name: businessName,
      business_type: selections.size[0] || "starter",
      onboarding_complete: true,
    }).eq("id", user.id)

    for (const ch of selections.channels) {
      const status = connectedChannels.includes(ch) ? "connected" : "disconnected"
      await supabase.from("channel_connections").upsert({
        user_id: user.id,
        channel: ch,
        status,
        credentials: {},
      }, { onConflict: "user_id,channel" })
    }
  }

  const handleFinish = async () => {
    setIsLoading(true)

    const messages = [
      "Setting up your workspace...",
      "Configuring marketplace connections...",
      "Preparing your dashboard...",
      "Customizing your experience...",
      "Almost ready...",
    ]

    for (let i = 0; i < messages.length; i++) {
      setLoadingMsg(messages[i])
      setLoadingProgress(Math.round(((i + 1) / messages.length) * 100))
      await new Promise((r) => setTimeout(r, 900))
    }

    await saveProfileAndChannels()

    // If any channel was connected during onboarding, go to scanning page
    if (connectedChannels.length > 0) {
      router.push("/store-scan")
    } else {
      router.push("/dashboard")
    }
  }

  const handleConnectChannel = (channel: string) => {
    const config = channelConfig[channel]
    if (!config) return

    setConnectingChannel(channel)

    // For Amazon, we use the existing OAuth flow
    // Store onboarding state so we can return after auth
    if (typeof window !== "undefined") {
      sessionStorage.setItem("onboarding_return", "true")
      sessionStorage.setItem("onboarding_state", JSON.stringify({
        businessName,
        selections,
        connectedChannels,
      }))
    }

    // Redirect to auth flow
    window.location.href = config.authPath
  }

  const handleSetupLater = () => {
    handleFinish()
  }

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      handleFinish()
      return
    }

    // If on step 4 (channels) and no channels selected, skip step 6 (connect)
    if (currentStep === 3 && selections.channels.length === 0) {
      // Skip to step 5 (features), then it will skip connect step
    }

    setIsAnimating(true)
    setTimeout(() => {
      setCurrentStep((prev) => prev + 1)
      setIsAnimating(false)
    }, 250)
  }

  const handleSkip = () => {
    handleFinish()
  }

  const toggleSelection = (type: string, id: string, single = false) => {
    setSelections((prev) => {
      if (single) return { ...prev, [type]: [id] }
      const current = prev[type] || []
      if (current.includes(id)) return { ...prev, [type]: current.filter((i) => i !== id) }
      return { ...prev, [type]: [...current, id] }
    })
  }

  const canProceed = () => {
    if (currentStep === 0) return businessName.trim().length > 0
    if (currentStep === 1) return selections.categories.length > 0
    if (currentStep === 2) return selections.size.length > 0
    if (currentStep === 3) return true
    if (currentStep === 4) return selections.features.length > 0
    if (currentStep === 5) return true // Can always proceed from connect step
    return true
  }

  // Restore state if returning from OAuth
  useEffect(() => {
    if (typeof window === "undefined") return
    const shouldReturn = sessionStorage.getItem("onboarding_return")
    if (shouldReturn) {
      const savedState = sessionStorage.getItem("onboarding_state")
      if (savedState) {
        try {
          const state = JSON.parse(savedState)
          setBusinessName(state.businessName || "")
          setSelections(state.selections || { categories: [], size: [], channels: [], features: [] })
          setConnectedChannels(state.connectedChannels || [])
        } catch {}
      }
      sessionStorage.removeItem("onboarding_return")
      sessionStorage.removeItem("onboarding_state")
      // Jump to the connect step
      setCurrentStep(5)
    }
  }, [])

  // Check URL params for successful connection callback
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get("connected")
    if (connected) {
      setConnectedChannels((prev) => prev.includes(connected) ? prev : [...prev, connected])
      // Clean up URL
      window.history.replaceState({}, "", "/onboarding")
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-lg font-semibold text-stone-900 mb-1">{loadingMsg}</h2>
          <p className="text-xs text-stone-400 mb-4">Customizing your dashboard</p>
          <div className="w-64 mx-auto bg-stone-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-stone-900 h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-xs text-stone-400 mt-3">{loadingProgress}%</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex flex-col">
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="Siml" className="w-7 h-7 rounded-md" />
          <span className="font-serif text-xl text-stone-900">Siml</span>
        </div>
        {currentStep < steps.length - 1 && (
          <button onClick={handleSkip} className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
            Skip setup
          </button>
        )}
      </header>

      <div className="px-6 mb-8">
        <div className="flex gap-2 max-w-md mx-auto">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500",
                i <= currentStep ? "bg-stone-900" : "bg-stone-200"
              )}
            />
          ))}
        </div>
      </div>

      <main className="flex-1 px-6 pb-6 flex flex-col">
        <div className={cn(
          "flex-1 max-w-lg mx-auto w-full transition-all duration-300",
          isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        )}>
          {currentStep === 0 && (
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-stone-600" />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center">
                <Link2 className="w-10 h-10 text-stone-600" />
              </div>
            </div>
          )}

          <h1 className="font-serif text-3xl text-stone-900 text-center mb-2">{step.title}</h1>
          <p className="text-stone-500 text-center mb-8">{step.subtitle}</p>

          {/* Step 1: Welcome - Name */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <p className="text-stone-600 text-center mb-4">{step.description}</p>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business or store name"
                className="w-full px-4 py-3 text-sm border border-stone-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
              />
            </div>
          )}

          {/* Step 2: Categories */}
          {currentStep === 1 && step.options && (
            <div className="grid grid-cols-2 gap-3">
              {step.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleSelection("categories", opt.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    selections.categories.includes(opt.id)
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:border-stone-300"
                  )}
                >
                  <span className="text-sm font-medium text-stone-900">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Size */}
          {currentStep === 2 && step.options && (
            <div className="space-y-3">
              {step.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleSelection("size", opt.id, true)}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between",
                    selections.size.includes(opt.id)
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:border-stone-300"
                  )}
                >
                  <div>
                    <span className="font-medium text-stone-900 block">{opt.label}</span>
                    <span className="text-sm text-stone-500">{opt.desc}</span>
                  </div>
                  {selections.size.includes(opt.id) && <Check className="w-5 h-5 text-stone-900" />}
                </button>
              ))}
            </div>
          )}

          {/* Step 4: Channels */}
          {currentStep === 3 && step.channels && (
            <div className="space-y-3">
              {step.channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggleSelection("channels", ch.id)}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all",
                    selections.channels.includes(ch.id)
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:border-stone-300"
                  )}
                >
                  <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", ch.color)}>{ch.label}</span>
                  {selections.channels.includes(ch.id) && (
                    <div className="w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 5: Features */}
          {currentStep === 4 && step.features && (
            <div className="grid grid-cols-2 gap-3">
              {step.features.map((feat) => {
                const Icon = feat.icon
                return (
                  <button
                    key={feat.id}
                    onClick={() => toggleSelection("features", feat.id)}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      selections.features.includes(feat.id)
                        ? "border-stone-900 bg-stone-50"
                        : "border-stone-200 hover:border-stone-300"
                    )}
                  >
                    <Icon className={cn("w-6 h-6 mb-2", selections.features.includes(feat.id) ? "text-stone-900" : "text-stone-400")} />
                    <span className="text-sm font-medium text-stone-900 block">{feat.label}</span>
                    <span className="text-xs text-stone-500">{feat.desc}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Step 6: Connect Store */}
          {currentStep === 5 && (
            <div className="space-y-4">
              {selections.channels.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-stone-500 text-sm mb-2">No channels selected in the previous step.</p>
                  <p className="text-stone-400 text-xs">You can connect your stores later from Settings.</p>
                </div>
              ) : (
                <>
                  <p className="text-stone-500 text-center text-sm mb-6">
                    Connect your accounts now to scan your store health, or set up later.
                  </p>
                  {selections.channels.map((channel) => {
                    const config = channelConfig[channel]
                    if (!config) return null
                    const isConnected = connectedChannels.includes(channel)
                    const isConnecting = connectingChannel === channel

                    return (
                      <div
                        key={channel}
                        className={cn(
                          "p-5 rounded-xl border-2 transition-all",
                          isConnected
                            ? "border-emerald-300 bg-emerald-50"
                            : `border-stone-200 ${config.bgColor}`
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-semibold border",
                              isConnected
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : `${config.bgColor} ${config.color} ${config.borderColor}`
                            )}>
                              {channel}
                            </span>
                            {isConnected && (
                              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <Check className="w-3.5 h-3.5" />
                                Connected
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-stone-500 mb-4">{config.description}</p>

                        {!isConnected && (
                          <button
                            onClick={() => handleConnectChannel(channel)}
                            disabled={isConnecting}
                            className={cn(
                              "w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all",
                              isConnecting
                                ? "bg-stone-200 text-stone-400 cursor-wait"
                                : "bg-stone-900 text-white hover:bg-stone-800"
                            )}
                          >
                            {isConnecting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-3.5 h-3.5" />
                                Connect {channel}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>

        <div className="max-w-lg mx-auto w-full mt-8">
          {currentStep === 5 ? (
            <div className="space-y-3">
              <button
                onClick={handleFinish}
                className="w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-1 transition-all bg-stone-900 text-white hover:bg-stone-800"
              >
                {connectedChannels.length > 0 ? (
                  <>
                    Continue to Store Scan
                    <Sparkles className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Set Up My Workspace
                    <Sparkles className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
              {connectedChannels.length === 0 && selections.channels.length > 0 && (
                <button
                  onClick={handleSetupLater}
                  className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1 text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-all"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Set up later
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                "w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-1 transition-all",
                canProceed()
                  ? "bg-stone-900 text-white hover:bg-stone-800"
                  : "bg-stone-200 text-stone-400 cursor-not-allowed"
              )}
            >
              {currentStep === steps.length - 1 ? "Set Up My Workspace" : "Continue"}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
              {currentStep === steps.length - 1 && <Sparkles className="w-4 h-4 ml-1" />}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
