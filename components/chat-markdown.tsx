"use client"

import React from "react"
import ReactMarkdown from "react-markdown"

interface ChatMarkdownProps {
  content: string
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="text-sm leading-relaxed chat-markdown">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-stone-900 mt-4 mb-2 first:mt-0 pb-1.5 border-b border-stone-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-stone-900 mt-4 mb-2 first:mt-0 pb-1 border-b border-stone-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-stone-800 mt-3 mb-1.5 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-stone-700 mt-2 mb-1 first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 text-stone-700 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-stone-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-stone-600">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-500 transition-colors"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 last:mb-0 ml-4 space-y-1 list-disc marker:text-stone-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 last:mb-0 ml-4 space-y-1 list-decimal marker:text-stone-500 marker:font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-stone-700 pl-1">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-stone-300 bg-stone-50 pl-3 py-1.5 my-2 rounded-r-md text-stone-600 italic">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-")
            if (isBlock) {
              return (
                <code className="block bg-stone-900 text-stone-100 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto">
                  {children}
                </code>
              )
            }
            return (
              <code className="bg-stone-100 text-stone-800 rounded px-1.5 py-0.5 text-xs font-mono">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-2 last:my-0">{children}</pre>
          ),
          hr: () => (
            <hr className="my-3 border-stone-200" />
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-stone-200">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-stone-50 border-b border-stone-200">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-stone-100">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-stone-50/50 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-stone-700">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-stone-600">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
