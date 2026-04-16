'use client'

import { useState, useEffect, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

// Global event bus for toasts
const listeners: ((toast: ToastItem) => void)[] = []

export function toast(message: string, type: ToastType = 'info') {
  const item: ToastItem = { id: `_${Math.random().toString(36).slice(2)}`, message, type }
  listeners.forEach(fn => fn(item))
}

export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((item: ToastItem) => {
    setToasts(prev => [...prev, item])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== item.id))
    }, 3500)
  }, [])

  useEffect(() => {
    listeners.push(addToast)
    return () => {
      const idx = listeners.indexOf(addToast)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm max-w-xs fade-in"
          style={{
            background: 'var(--bg3)',
            border: `1px solid var(--border2)`,
            borderLeft: `3px solid ${
              t.type === 'success' ? 'var(--green)' :
              t.type === 'error'   ? 'var(--red)' :
              t.type === 'warning' ? 'var(--amber)' : 'var(--accent)'
            }`,
            color: 'var(--text)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
