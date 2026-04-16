// components/ui/index.tsx — small reusable primitives

import type { RiskLevel, AssessmentStatus } from '@/types'
import { daysUntil } from '@/lib/weeks'

// ── Progress bar ────────────────────────────────────────────────────────────
interface ProgressBarProps {
  value: number        // 0–100
  colour?: 'accent' | 'teal' | 'amber' | 'red' | 'green'
  height?: number
}

const COLOURS = {
  accent: 'var(--accent)',
  teal:   'var(--teal)',
  amber:  'var(--amber)',
  red:    'var(--red)',
  green:  'var(--green)',
}

export function ProgressBar({ value, colour = 'accent', height = 6 }: ProgressBarProps) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: 'var(--bg4)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: COLOURS[colour] }}
      />
    </div>
  )
}

// ── Difficulty dots ──────────────────────────────────────────────────────────
export function DifficultyMeter({ value }: { value: number }) {
  const col = value >= 8 ? 'var(--red)' : value >= 6 ? 'var(--amber)' : 'var(--accent)'
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < value ? col : 'var(--bg4)',
          }}
        />
      ))}
      <span className="font-mono text-xs ml-1.5" style={{ color: 'var(--text2)' }}>{value}/10</span>
    </div>
  )
}

// ── Risk badge ───────────────────────────────────────────────────────────────
export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`risk-badge risk-${level}`}>{level}</span>
}

// ── Status badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: AssessmentStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {status.replace('-', ' ')}
    </span>
  )
}

// ── Countdown chip ───────────────────────────────────────────────────────────
export function CountdownChip({ dateStr }: { dateStr: string | null | undefined }) {
  const days = daysUntil(dateStr)
  if (days === null) return <span className="chip chip-future">TBA</span>
  if (days < 0)  return <span className="chip chip-urgent">Overdue</span>
  if (days === 0) return <span className="chip chip-urgent">TODAY</span>
  if (days <= 2)  return <span className="chip chip-urgent">{days}d</span>
  if (days <= 7)  return <span className="chip chip-soon">{days}d</span>
  if (days <= 14) return <span className="chip chip-ok">{days}d</span>
  return <span className="chip chip-future">{days}d</span>
}

// ── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  colour?: 'default' | 'accent' | 'teal' | 'amber' | 'red' | 'green'
}

const STAT_COLOURS = {
  default: 'var(--text)',
  accent:  'var(--accent)',
  teal:    'var(--teal)',
  amber:   'var(--amber)',
  red:     'var(--red)',
  green:   'var(--green)',
}

export function StatCard({ label, value, sub, colour = 'default' }: StatCardProps) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
    >
      <div className="section-heading mb-2">{label}</div>
      <div
        className="font-mono text-3xl font-semibold leading-none"
        style={{ color: STAT_COLOURS[colour] }}
      >
        {value}
      </div>
      {sub && <div className="text-xs mt-1.5" style={{ color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-6">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-medium text-lg mb-2" style={{ color: 'var(--text2)' }}>{title}</div>
      {description && <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--text3)' }}>{description}</p>}
      {action}
    </div>
  )
}

// ── Section heading ──────────────────────────────────────────────────────────
export function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="section-heading mb-0">{children}</div>
      {action}
    </div>
  )
}

// ── Alert strip ──────────────────────────────────────────────────────────────
type AlertType = 'warning' | 'danger' | 'info' | 'success'

const ALERT_STYLES: Record<AlertType, { bg: string; border: string; color: string }> = {
  warning: { bg: 'var(--amber-dim)', border: 'rgba(245,166,35,0.2)',  color: 'var(--amber)' },
  danger:  { bg: 'var(--red-dim)',   border: 'rgba(240,82,82,0.2)',   color: 'var(--red)' },
  info:    { bg: 'var(--accent-glow)',border: 'rgba(124,92,252,0.2)', color: 'var(--accent)' },
  success: { bg: 'var(--green-dim)', border: 'rgba(74,222,128,0.2)',  color: 'var(--green)' },
}

export function Alert({ type, children }: { type: AlertType; children: React.ReactNode }) {
  const s = ALERT_STYLES[type]
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm mb-3"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {children}
    </div>
  )
}

// ── Form field wrapper ────────────────────────────────────────────────────────
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text2)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>{hint}</p>}
    </div>
  )
}

// ── Pill toggle ───────────────────────────────────────────────────────────────
interface PillProps {
  label: string
  selected: boolean
  onClick: () => void
}

export function Pill({ label, selected, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        background: selected ? 'var(--accent-glow)' : 'var(--bg3)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border2)'}`,
        color: selected ? 'var(--accent)' : 'var(--text2)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
import { Modal, ModalFooter } from './Modal'

interface ConfirmProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({ open, onConfirm, onCancel, title = 'Confirm', message, confirmLabel = 'Confirm', danger = false }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm" style={{ color: 'var(--text2)' }}>{message}</p>
      <ModalFooter>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
      </ModalFooter>
    </Modal>
  )
}
