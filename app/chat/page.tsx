"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import Link from "next/link"
import { ArrowUp, Loader2, Sparkles, Menu, Bell, Upload, FileText, ImageIcon, AlertCircle, Activity, Download, Package, ShieldCheck, DollarSign, BarChart3, Link2, ChevronDown, ScanSearch, Trash2, History } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { ChatMarkdown } from "@/components/chat-markdown"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const CHAT_HISTORY_KEY = "siml-chat-history"
const MAX_HISTORY_SESSIONS = 20

interface ChatSession {
  id: string
  title: string
  timestamp: number
  messages: any[]
}

function saveChatHistory(sessions: ChatSession[]) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_HISTORY_SESSIONS)))
  } catch {}
}

function loadChatHistory(): ChatSession[] {
  try {
    const data = localStorage.getItem(CHAT_HISTORY_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function generatePDF(markdownContent: string, title: string) {
  // Use browser print to create a well-formatted PDF
  const printWindow = window.open("", "_blank")
  if (!printWindow) return

  // Convert markdown to simple HTML
  const htmlContent = markdownContent
    .replace(/^### (.*$)/gm, '<h3 style="margin:12px 0 6px;font-size:14px;font-weight:600;color:#1c1917;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="margin:16px 0 8px;font-size:16px;font-weight:700;color:#1c1917;border-bottom:1px solid #e7e5e4;padding-bottom:6px;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="margin:20px 0 10px;font-size:20px;font-weight:700;color:#1c1917;border-bottom:2px solid #d6d3d1;padding-bottom:8px;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li style="margin:2px 0;padding-left:4px;">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li style="margin:2px 0;padding-left:4px;">$2</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => {
      return `<ul style="margin:6px 0;padding-left:20px;list-style-type:disc;">${match}</ul>`
    })
    .replace(/^(?!<[hul])(.*$)/gm, (match) => {
      if (match.trim() === "" || match.trim() === "---") return match
      if (match.startsWith("<")) return match
      return `<p style="margin:4px 0;line-height:1.6;color:#44403c;">${match}</p>`
    })
    .replace(/^---$/gm, '<hr style="margin:16px 0;border:none;border-top:1px solid #e7e5e4;">')

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @media print {
          body { margin: 0; }
          @page { margin: 0.75in; }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
          color: #1c1917;
          font-size: 13px;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #292524;
        }
        .header h1 { font-size: 24px; margin: 0 0 8px; color: #292524; }
        .header p { color: #78716c; font-size: 12px; margin: 0; }
        .content { margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Siml Store Report</h1>
        <p>Generated on ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${new Date().toLocaleTimeString()}</p>
      </div>
      <div class="content">
        ${htmlContent}
      </div>
    </body>
    </html>
  `)
  printWindow.document.close()

  // Wait for content to render then trigger print (which allows Save as PDF)
  setTimeout(() => {
    printWindow.print()
  }, 500)
}

export default function ChatPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const [chatError, setChatError] = useState("")
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [currentSessionId] = useState(() => `session-${Date.now()}`)

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err: Error) => {
      console.log("[Chat] Error:", err)
      setChatError(err.message || "Failed to get a response. Check your API key configuration.")
    },
  })

  const getMessageParts = useCallback((msg: any) => {
    if (!msg.parts || !Array.isArray(msg.parts)) {
      return { text: msg.content || "", hasToolCalls: false, toolResults: [], toolCalls: [] }
    }
    const textParts = msg.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
    const toolCalls = msg.parts.filter((p: any) => p.type === "tool-invocation")
    const hasToolCalls = toolCalls.length > 0
    return { text: textParts, hasToolCalls, toolCalls }
  }, [])

  // Load chat history on mount
  useEffect(() => {
    setChatHistory(loadChatHistory())
  }, [])

  // Save current conversation to history when messages change
  useEffect(() => {
    if (messages.length === 0) return
    const firstUserMsg = messages.find(m => m.role === "user")
    const title = firstUserMsg
      ? (getMessageParts(firstUserMsg).text || "Chat").slice(0, 60)
      : "Chat"

    const currentSession: ChatSession = {
      id: currentSessionId,
      title,
      timestamp: Date.now(),
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: getMessageParts(m).text || "",
        parts: (m as any).parts,
      })),
    }

    setChatHistory(prev => {
      const filtered = prev.filter(s => s.id !== currentSessionId)
      const updated = [currentSession, ...filtered].slice(0, MAX_HISTORY_SESSIONS)
      saveChatHistory(updated)
      return updated
    })
  }, [messages, currentSessionId, getMessageParts])

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

  const scanOptions = [
    {
      id: "full",
      label: "Full Store Scan",
      description: "Comprehensive analysis of everything",
      icon: ScanSearch,
      prompt: "Run a full store scan. Give me a summary report of my store health, inventory status, sales performance, and top recommendations. Keep it concise with key metrics and actionable items.",
    },
    {
      id: "inventory",
      label: "Inventory Health",
      description: "Stock levels, low stock alerts, dead stock",
      icon: Package,
      prompt: "Run an inventory health check. Show me summary stats, low stock alerts, and reordering recommendations. Focus on items that need attention, not a full product list.",
    },
    {
      id: "account",
      label: "Account Health & Compliance",
      description: "Policy violations, account risks",
      icon: ShieldCheck,
      prompt: "Check my account health and compliance status. Review for any policy violations, account risk indicators, listing compliance issues, and give me a report with steps to fix any problems.",
    },
    {
      id: "financial",
      label: "Financial Summary",
      description: "Revenue, margins, fees breakdown",
      icon: DollarSign,
      prompt: "Give me a financial summary. Analyze my revenue, profit margins, fee breakdowns, and identify opportunities to improve my profitability with actionable recommendations.",
    },
    {
      id: "listings",
      label: "Listing Performance",
      description: "Top/worst performers, optimization tips",
      icon: BarChart3,
      prompt: "Analyze my listing performance. Identify my top performing and worst performing products, check listing quality, and give me optimization recommendations to improve sales.",
    },
    {
      id: "channels",
      label: "Channel Status",
      description: "Connection health across marketplaces",
      icon: Link2,
      prompt: "Check my channel connection status across all marketplaces. Report on which channels are connected, any sync issues, and recommendations for improving my multi-channel setup.",
    },
  ]

  const handleScanOption = (prompt: string) => {
    if (isLoading) return
    setChatError("")
    sendMessage({ text: prompt })
  }

  const handleDownloadSingleReport = (text: string) => {
    const title = `Siml Report - ${new Date().toISOString().slice(0, 10)}`
    const header = `# Siml Store Analysis Report\n\n**Generated:** ${new Date().toLocaleString()}\n\n---\n\n`
    const content = header + text
    generatePDF(content, title)
  }

  const suggestedPrompts = [
    "Which of my products are low on stock and need reordering?",
    "Show me my top 5 best selling products this month",
    "What can I do to reduce my cancellation rate?",
    "What's my current account health status?",
  ]

  const loadHistorySession = (session: ChatSession) => {
    setMessages(session.messages as any)
    setShowHistory(false)
  }

  const deleteHistorySession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChatHistory(prev => {
      const updated = prev.filter(s => s.id !== sessionId)
      saveChatHistory(updated)
      return updated
    })
  }

  const startNewChat = () => {
    setMessages([])
    setChatError("")
    setShowHistory(false)
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
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-stone-400" />
              <h2 className="text-sm font-medium text-stone-900">Siml AI Assistant</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Chat History Toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border",
                showHistory
                  ? "text-stone-900 bg-stone-200 border-stone-300"
                  : "text-stone-600 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 border-stone-200"
              )}
              title="Chat history"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>
            {messages.length > 0 && (
              <button
                onClick={startNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 rounded-lg transition-all border border-stone-200"
                title="New chat"
              >
                <span>New Chat</span>
              </button>
            )}
            <Link href="/notifications" className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Chat History Panel */}
        {showHistory && (
          <div className="absolute top-14 right-0 w-80 h-[calc(100%-3.5rem)] bg-white border-l border-stone-200 z-20 flex flex-col shadow-lg">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">Chat History</h3>
              <button onClick={() => setShowHistory(false)} className="text-xs text-stone-400 hover:text-stone-600">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chatHistory.length === 0 ? (
                <div className="p-6 text-center">
                  <History className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-500">No chat history yet</p>
                  <p className="text-xs text-stone-400 mt-1">Your conversations will appear here</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {chatHistory.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadHistorySession(session)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-all group",
                        session.id === currentSessionId
                          ? "bg-stone-100 border border-stone-200"
                          : "hover:bg-stone-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-stone-900 truncate">{session.title}</p>
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            {new Date(session.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {" "}
                            {new Date(session.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {" · "}
                            {session.messages.length} messages
                          </p>
                        </div>
                        {session.id !== currentSessionId && (
                          <button
                            onClick={(e) => deleteHistorySession(session.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 rounded transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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

                {/* Scan & Analyze Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={isLoading}
                      className="mb-6 flex items-center gap-2.5 px-6 py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Activity className="w-4 h-4" />
                      Scan & Analyze My Store
                      <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-72 bg-white rounded-xl shadow-xl border border-stone-200 p-1.5">
                    <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                      Choose scan type
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-stone-100" />
                    {scanOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => handleScanOption(option.prompt)}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-stone-50 focus:bg-stone-50"
                      >
                        <div className="mt-0.5 w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                          <option.icon className="w-4 h-4 text-stone-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-stone-900">{option.label}</span>
                          <span className="text-xs text-stone-500">{option.description}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

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
                      {text && (
                        msg.role === "assistant"
                          ? <ChatMarkdown content={text} />
                          : <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                      )}
                      {/* Per-message download button for assistant messages with content */}
                      {msg.role === "assistant" && text && text.length > 100 && (
                        <div className="mt-3 pt-2 border-t border-stone-100 flex justify-end">
                          <button
                            onClick={() => handleDownloadSingleReport(text)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded-md transition-all"
                            title="Download this response as PDF"
                          >
                            <Download className="w-3 h-3" />
                            Download PDF
                          </button>
                        </div>
                      )}
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
                  {/* Scan & Analyze inline dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Scan & Analyze Store"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium hidden sm:inline">Scan</span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-64 bg-white rounded-xl shadow-xl border border-stone-200 p-1.5 mb-2">
                      <DropdownMenuLabel className="px-3 py-1.5 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                        Scan options
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-stone-100" />
                      {scanOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.id}
                          onClick={() => handleScanOption(option.prompt)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-stone-50 focus:bg-stone-50"
                        >
                          <option.icon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          <span className="text-xs font-medium text-stone-700">{option.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
