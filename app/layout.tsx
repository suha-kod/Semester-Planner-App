import type { Metadata } from 'next'
import { DM_Sans, DM_Mono, Fraunces } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '500'],
})

export const metadata: Metadata = {
  title: 'Tracker — Semester HQ',
  description: 'Your intelligent university semester command centre',
  manifest: '/manifest.json',
  themeColor: '#0f0f11',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${dmSans.variable} ${dmMono.variable} ${fraunces.variable} font-sans antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
