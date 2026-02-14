"use client"

import { useState, useEffect } from "react"
import { DollarSign, Bell, Menu, Plus, Trash2, X, Zap, TrendingDown, Percent, Shield } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { storage } from "@/lib/storage"
import type { RepricingRule } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function RepricingPage() {
  const [rules, setRules] = useState<RepricingRule[]>([])

  const [showNewForm, setShowNewForm] = useState(false)
  const [newRule, setNewRule] = useState({
    name: "",
    strategy: "match_lowest" as RepricingRule["strategy"],
    value: 0,
    minPrice: 5,
    maxPrice: 500,
  })

  useEffect(() => {
    setRules(storage.getRepricingRules())

  }, [])

  const getStrategyIcon = (strategy: RepricingRule["strategy"]) => {
    switch (strategy) {
      case "match_lowest":
        return TrendingDown
      case "beat_by_percent":
        return Percent
      case "beat_by_amount":
        return DollarSign
      case "stay_above_cost":
        return Shield
      default:
        return Zap
    }
  }

  const getStrategyLabel = (strategy: RepricingRule["strategy"]) => {
    switch (strategy) {
      case "match_lowest":
        return "Match Lowest"
      case "beat_by_percent":
        return "Beat by %"
      case "beat_by_amount":
        return "Beat by $"
      case "stay_above_cost":
        return "Above Cost"
      default:
        return strategy
    }
  }

  const handleToggleRule = (id: string, isActive: boolean) => {
    const rule = rules.find((r) => r.id === id)
    if (rule) {
      storage.saveRepricingRule({ ...rule, isActive })
      setRules(storage.getRepricingRules())
    }
  }

  const handleDeleteRule = (id: string) => {
    storage.deleteRepricingRule(id)
    setRules(storage.getRepricingRules())
  }

  const handleCreateRule = () => {
    if (!newRule.name) return

    const rule: RepricingRule = {
      id: Date.now().toString(),
      name: newRule.name,
      strategy: newRule.strategy,
      value: newRule.value,
      minPrice: newRule.minPrice,
      maxPrice: newRule.maxPrice,
      isActive: true,
      appliedTo: 0,
    }

    storage.saveRepricingRule(rule)
    setRules(storage.getRepricingRules())
    setShowNewForm(false)
    setNewRule({
      name: "",
      strategy: "match_lowest",
      value: 0,
      minPrice: 5,
      maxPrice: 500,
    })
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col relative bg-[#FBFBF9] h-full">
        {/* Header */}
        <header className="h-14 px-4 md:px-6 flex items-center justify-between shrink-0 border-b border-stone-100/50">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 -ml-2 text-stone-500">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-medium text-stone-500">
              Workspace / <span className="text-stone-900">Repricing Rules</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => setShowNewForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Rule</span>
            </Button>
            <button className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-48">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* New Rule Form */}
            {showNewForm && (
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-stone-900">New Repricing Rule</h3>
                  <button onClick={() => setShowNewForm(false)} className="p-1 text-stone-400 hover:text-stone-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-stone-700 mb-1">Rule Name</label>
                    <Input
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      placeholder="e.g., Match FBA Sellers"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Strategy</label>
                    <select
                      value={newRule.strategy}
                      onChange={(e) => setNewRule({ ...newRule, strategy: e.target.value as any })}
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                    >
                      <option value="match_lowest">Match Lowest Price</option>
                      <option value="beat_by_percent">Beat by Percentage</option>
                      <option value="beat_by_amount">Beat by Amount</option>
                      <option value="stay_above_cost">Stay Above Cost</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {newRule.strategy === "beat_by_percent"
                        ? "Percentage"
                        : newRule.strategy === "stay_above_cost"
                          ? "Margin %"
                          : "Amount"}
                    </label>
                    <Input
                      type="number"
                      value={newRule.value}
                      onChange={(e) => setNewRule({ ...newRule, value: Number.parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Min Price</label>
                    <Input
                      type="number"
                      value={newRule.minPrice}
                      onChange={(e) => setNewRule({ ...newRule, minPrice: Number.parseFloat(e.target.value) || 0 })}
                      placeholder="5.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Max Price</label>
                    <Input
                      type="number"
                      value={newRule.maxPrice}
                      onChange={(e) => setNewRule({ ...newRule, maxPrice: Number.parseFloat(e.target.value) || 0 })}
                      placeholder="500.00"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={() => setShowNewForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRule}>Create Rule</Button>
                </div>
              </div>
            )}

            {/* Rules List */}
            <div className="space-y-3">
              {rules.map((rule) => {
                const StrategyIcon = getStrategyIcon(rule.strategy)
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "bg-white rounded-xl border p-5 transition-all",
                      rule.isActive ? "border-stone-200" : "border-stone-100 opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg", rule.isActive ? "bg-stone-100" : "bg-stone-50")}>
                          <StrategyIcon className="w-5 h-5 text-stone-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900">{rule.name}</div>
                          <div className="text-sm text-stone-500 mt-0.5">
                            {getStrategyLabel(rule.strategy)}
                            {rule.value > 0 &&
                              ` • ${rule.strategy.includes("percent") ? `${rule.value}%` : `$${rule.value}`}`}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                            <span>Min: ${rule.minPrice.toFixed(2)}</span>
                            <span>Max: ${rule.maxPrice.toFixed(2)}</span>
                            <span className="text-stone-900 font-medium">{rule.appliedTo} products</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                        />
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {rules.length === 0 && !showNewForm && (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="w-6 h-6 text-stone-400" />
                </div>
                <p className="text-stone-500 text-sm">
                  No repricing rules yet. Create your first rule to automate pricing.
                </p>
                <Button onClick={() => setShowNewForm(true)} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Rule
                </Button>
              </div>
            )}
          </div>
        </div>

        
      </main>

      <MobileNav />
    </div>
  )
}
