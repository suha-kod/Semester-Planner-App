'use client'

import { useEffect, useRef } from 'react'
import { XMarkIcon } from '../layout/Icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
}

const SIZES = { sm: '480px', md: '580px', lg: '720px', xl: '920px' }

export function Modal({ open, onClose, title, subtitle, size = 'md', children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="w-full rounded-2xl overflow-y-auto max-h-[90vh] fade-in"
        style={{
          maxWidth: SIZES[size],
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-7 pb-0">
          <div>
            <h2 className="font-serif text-2xl font-light" style={{ color: 'var(--text)' }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon ml-4 flex-shrink-0"
            style={{ marginTop: '2px' }}
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-7">{children}</div>
      </div>
    </div>
  )
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4" style={{ borderTop: '1px solid var(--border)', marginTop: '8px' }}>
      {children}
    </div>
  )
}
