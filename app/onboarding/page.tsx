"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Check, ChevronRight, Sparkles, Package, BarChart3, Truck, Tag } from "lucide-react"
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
]

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

  const handleFinish = async () => {
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

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

    if (user) {
      await supabase.from("profiles").update({
        business_name: businessName,
        business_type: selections.size[0] || "starter",
        onboarding_complete: true,
      }).eq("id", user.id)

      for (const ch of selections.channels) {
        await supabase.from("channel_connections").upsert({
          user_id: user.id,
          channel: ch,
          status: "disconnected",
          credentials: {},
        }, { onConflict: "user_id,channel" })
      }
    }

    router.push("/dashboard")
  }

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      handleFinish()
      return
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
    return true
  }

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
        </div>

        <div className="max-w-lg mx-auto w-full mt-8">
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
        </div>
      </main>
    </div>
  )
}
