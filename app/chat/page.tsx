"use client"

import React, { useRef, useEffect, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import Link from "next/link"
import { ArrowUp, Loader2, Sparkles, Menu, Bell, Upload, FileText, ImageIcon, AlertCircle, Activity, Download } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { cn } from "@/lib/utils"

export default function ChatPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const [chatError, setChatError] = useState("")

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err: Error) => {
      console.log("[Chat] Error:", err)
      setChatError(err.message || "Failed to get a response. Check your API key configuration.")
    },
  })

  // Show error from the hook
  useEffect(() => {
    if (error) {
      setChatError(error.message || "Chat connection error")
    }
  }, [error])

  const isLoading = status === "streaming" || status === "submitted"

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    setChatError("")
    sendMessage({ text: input })
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        sendMessage({ text: input })
        setInput("")
      }
    }
  }

  const handlePromptClick = (prompt: string) => {
    if (isLoading) return
    setChatError("")
    sendMessage({ text: prompt })
  }

  const handleScanAndAnalyze = () => {
    if (isLoading) return
    setChatError("")
    sendMessage({
      text: "Run a full store scan and analysis. Check my inventory health, find low stock alerts, identify problems, review account health indicators, check compliance issues, and give me a comprehensive report with actionable recommendations.",
    })
  }

  const handleDownloadReport = () => {
    // Collect all assistant messages text
    const reportLines: string[] = []
    reportLines.push("SIML STORE ANALYSIS REPORT")
    reportLines.push("=" .repeat(50))
    reportLines.push(`Generated: ${new Date().toLocaleString()}`)
    reportLines.push("")

    for (const msg of messages) {
      const { text } = getMessageParts(msg)
      if (msg.role === "assistant" && text) {
        reportLines.push(text)
        reportLines.push("")
        reportLines.push("-".repeat(50))
        reportLines.push("")
      }
    }

    if (reportLines.length <= 4) {
      // No content to download
      return
    }

    const blob = new Blob([reportLines.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `siml-report-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const suggestedPrompts = [
    "How can I improve my profit margins?",
    "What are my best selling products?",
    "Help me optimize my inventory",
    "How do I connect my Amazon Seller Account?",
  ]

  const getMessageParts = (msg: any) => {
    if (!msg.parts || !Array.isArray(msg.parts)) {
      return { text: msg.content || "", hasToolCalls: false, toolResults: [] }
    }
    const textParts = msg.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
    const toolCalls = msg.parts.filter((p: any) => p.type === "tool-invocation")
    const hasToolCalls = toolCalls.length > 0
    return { text: textParts, hasToolCalls, toolCalls }
  }

  const hasAssistantMessages = messages.some(
    (msg) => msg.role === "assistant" && getMessageParts(msg).text
  )

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
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-stone-400" />
              <h2 className="text-sm font-medium text-stone-900">Siml AI Assistant</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Report Button */}
            {hasAssistantMessages && (
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                title="Download report"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download Report</span>
              </button>
            )}
            <Link href="/notifications" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-48 md:pb-40">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-stone-400" />
                </div>
                <h2 className="font-serif text-2xl text-stone-900 mb-2">How can I help you today?</h2>
                <p className="text-stone-500 mb-8 max-w-md">
                  Ask me anything about your inventory, sales analytics, pricing strategies, or e-commerce operations.
                </p>

                {/* Scan & Analyze Button */}
                <button
                  onClick={handleScanAndAnalyze}
                  disabled={isLoading}
                  className="mb-6 flex items-center gap-2.5 px-6 py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Activity className="w-4 h-4" />
                  Scan & Analyze My Store
                </button>

                {/* Suggested Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handlePromptClick(prompt)}
                      disabled={isLoading}
                      className="p-3 text-left text-sm text-stone-600 bg-white border border-stone-200 rounded-xl hover:border-stone-300 hover:bg-stone-50 transition-all disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const { text, hasToolCalls, toolCalls } = getMessageParts(msg)
                // Skip empty assistant messages (intermediate tool-call-only messages)
                if (msg.role === "assistant" && !text && !hasToolCalls) return null

                return (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-stone-900 text-white"
                          : "bg-white border border-stone-200 text-stone-800"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-stone-100">
                          <Sparkles className="w-3 h-3 text-stone-400" />
                          <span className="text-xs font-medium text-stone-500">Siml AI</span>
                        </div>
                      )}
                      {/* Show tool call indicators */}
                      {hasToolCalls && toolCalls.map((tc: any, i: number) => {
                        const inv = tc.toolInvocation || tc
                        const toolName = inv.toolName || "tool"
                        const state = inv.state || "call"
                        const friendlyNames: Record<string, string> = {
                          searchInventory: "Searching inventory",
                          getInventorySummary: "Getting inventory summary",
                          getOrders: "Looking up orders",
                          getListings: "Checking listings",
                          getChannelStatus: "Checking channel status",
                          getFinancialSummary: "Getting financial data",
                          runStoreScan: "Running full store scan",
                        }
                        if (state === "result" && text) return null // Don't show if we have text
                        return (
                          <div key={i} className="flex items-center gap-2 py-1 text-xs text-stone-500">
                            {state !== "result" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                            )}
                            <span>{friendlyNames[toolName] || toolName}...</span>
                          </div>
                        )
                      })}
                      {text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>}
                    </div>
                  </div>
                )
              })
            )}

            {/* Error display */}
            {chatError && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-red-50 border border-red-200 text-red-800">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-200">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <span className="text-xs font-medium text-red-600">Error</span>
                  </div>
                  <p className="text-sm leading-relaxed">{chatError}</p>
                  <p className="text-xs text-red-500 mt-2">
                    If this error persists, check that the Gemini API key is configured correctly in your environment settings.
                  </p>
                </div>
              </div>
            )}

            {isLoading && messages.length > 0 && (() => {
              const lastMsg = messages[messages.length - 1]
              // Only show "Thinking" if the last message is from the user (AI hasn't started yet)
              // OR if the last assistant message has no content and no tool calls
              const showThinking = lastMsg?.role === "user" ||
                (lastMsg?.role === "assistant" && !getMessageParts(lastMsg).text && !getMessageParts(lastMsg).hasToolCalls)
              return showThinking ? (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                    <span className="text-sm text-stone-500">Thinking...</span>
                  </div>
                </div>
              ) : null
            })()}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-16 md:bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#FBFBF9] via-[#FBFBF9] to-transparent pt-12 z-10">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="relative bg-white shadow-lg border border-stone-200 rounded-2xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent border-0 rounded-2xl pt-4 pb-14 px-5 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-0 focus:outline-none resize-none font-medium"
                rows={1}
                placeholder="Ask about inventory, sales, pricing..."
                style={{ minHeight: "60px", maxHeight: "160px" }}
              />

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button type="button" className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors" title="Upload file">
                    <Upload className="w-4 h-4" />
                  </button>
                  <button type="button" className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors" title="Upload document">
                    <FileText className="w-4 h-4" />
                  </button>
                  <button type="button" className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors" title="Upload image">
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <div className="h-4 w-px bg-stone-200 mx-1" />
                  {/* Scan & Analyze inline button */}
                  <button
                    type="button"
                    onClick={handleScanAndAnalyze}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Scan & Analyze Store"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium hidden sm:inline">Scan</span>
                  </button>
                  <div className="h-4 w-px bg-stone-200 mx-1" />
                  <div className="flex items-center gap-1 px-1">
                    <Sparkles className="w-3 h-3 text-stone-400" />
                    <span className="text-[10px] text-stone-400 font-medium">Powered by AI</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "p-2 rounded-xl shadow transition-all duration-200",
                    input.trim() && !isLoading
                      ? "bg-stone-900 text-white hover:bg-stone-800 hover:scale-105 active:scale-95"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  )}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      <MobileNav />
    </div>
  )
}
