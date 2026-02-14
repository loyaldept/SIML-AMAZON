import type React from "react"
import type { Metadata } from "next"
import { Inter, Newsreader } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
  variable: "--font-newsreader",
})

export const metadata: Metadata = {
  title: "Siml - Multi-Channel Listing Manager",
  description: "AI-powered multi-channel e-commerce listing and inventory manager",
  generator: "v0.app",
  icons: {
    icon: "/favicon.png",
  },
}

import { LanguageProvider } from "@/lib/i18n"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable} font-sans`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
