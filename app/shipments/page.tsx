"use client"

import { useState, useEffect } from "react"
import { Truck, Package, Bell, Menu, Plus, MapPin, Calendar, ChevronRight } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"

import { Button } from "@/components/ui/button"
import { storage } from "@/lib/storage"
import type { Shipment } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])


  useEffect(() => {
    setShipments(storage.getShipments())

  }, [])

  const getStatusColor = (status: Shipment["status"]) => {
    switch (status) {
      case "draft":
        return "bg-stone-100 text-stone-600"
      case "working":
        return "bg-yellow-100 text-yellow-700"
      case "shipped":
        return "bg-blue-100 text-blue-700"
      case "receiving":
        return "bg-purple-100 text-purple-700"
      case "closed":
        return "bg-emerald-100 text-emerald-700"
      default:
        return "bg-stone-100 text-stone-600"
    }
  }

  const getStatusIcon = (status: Shipment["status"]) => {
    switch (status) {
      case "shipped":
      case "receiving":
        return Truck
      default:
        return Package
    }
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
              Workspace / <span className="text-stone-900">Shipments</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Shipment</span>
            </Button>
            <button className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-48">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "In Transit", value: shipments.filter((s) => s.status === "shipped").length },
                { label: "Receiving", value: shipments.filter((s) => s.status === "receiving").length },
                { label: "Working", value: shipments.filter((s) => s.status === "working").length },
                { label: "Completed", value: shipments.filter((s) => s.status === "closed").length },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="text-2xl font-semibold text-stone-900 font-serif">{stat.value}</div>
                  <div className="text-xs text-stone-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Shipments List */}
            <div className="space-y-3">
              {shipments.map((shipment) => {
                const StatusIcon = getStatusIcon(shipment.status)
                return (
                  <div
                    key={shipment.id}
                    className="bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-300 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-stone-100">
                          <StatusIcon className="w-5 h-5 text-stone-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900">{shipment.shipmentId}</div>
                          <div className="text-sm text-stone-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {shipment.destination}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-medium",
                            getStatusColor(shipment.status),
                          )}
                        >
                          {shipment.status}
                        </span>
                        <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-500 transition-colors" />
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-stone-500">Items:</span>
                        <span className="font-medium text-stone-900 ml-1">{shipment.items}</span>
                      </div>
                      <div>
                        <span className="text-stone-500">Units:</span>
                        <span className="font-medium text-stone-900 ml-1">{shipment.units}</span>
                      </div>
                      <div className="flex items-center gap-1 text-stone-500">
                        <Calendar className="w-3 h-3" />
                        <span>Created {new Date(shipment.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {shipments.length === 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
                  <Truck className="w-6 h-6 text-stone-400" />
                </div>
                <p className="text-stone-500 text-sm">No shipments yet. Create your first shipment to get started.</p>
              </div>
            )}
          </div>
        </div>

        
      </main>

      <MobileNav />
    </div>
  )
}
