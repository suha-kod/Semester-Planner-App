'use client'

import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { Sidebar } from './Sidebar'
import { SetupWizard } from '../setup/SetupWizard'
import { Toast } from '../ui/Toast'

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrate = useStore(s => s.hydrate)
  const hydrated = useStore(s => s.hydrated)
  const profile = useStore(s => s.profile)
  const semesters = useStore(s => s.semesters)
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!hydrated) return
    const hasSetup = semesters.some(s => s.name && s.name.length > 0)
    setShowSetup(!hasSetup)
  }, [hydrated, semesters])

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement
    if (profile.theme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
  }, [profile.theme])

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="text-2xl font-serif mb-2" style={{ color: 'var(--text)' }}>Tracker</div>
          <div className="text-sm" style={{ color: 'var(--text3)' }}>Loading your semester...</div>
        </div>
      </div>
    )
  }

  if (showSetup) {
    return <SetupWizard onComplete={() => setShowSetup(false)} />
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ marginLeft: '220px', minHeight: '100vh' }}>
        {children}
      </main>
      <Toast />
    </div>
  )
}
