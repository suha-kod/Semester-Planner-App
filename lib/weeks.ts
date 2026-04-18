// lib/weeks.ts

import type { Semester } from '@/types'

/** Teaching week number for today, skipping break weeks */
export function currentWeekNumber(semester: Semester | undefined): number {
  if (!semester?.startDate) return 1
  const start = new Date(semester.startDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const totalDays = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  if (totalDays < 0) return 1

  const weeksElapsed = Math.floor(totalDays / 7) + 1
  const breaks = new Set(semester.breakWeeks ?? [])
  let teaching = 0
  for (let w = 1; w <= weeksElapsed; w++) {
    if (!breaks.has(w)) teaching++
  }
  return Math.max(1, Math.min(semester.totalWeeks, teaching))
}

/** Days from today until a date string (negative = overdue) */
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function todayISO(): string {
  return isoFromDate(new Date())
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function weekDateRange(weekOffset = 0): { monday: Date; sunday: Date; days: Date[] } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
  return { monday, sunday, days }
}

const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

/** Compute YYYY-MM-DD for a given teaching week + day of week, skipping break weeks */
export function teachingWeekDate(semStart: string, breakWeeks: number[], teachingWeek: number, dayName: string): string {
  const start = new Date(semStart + 'T00:00:00')
  const dow = start.getDay()
  const toMon = dow === 0 ? -6 : 1 - dow
  const startMon = new Date(start)
  startMon.setDate(start.getDate() + toMon)
  let calWeek = 1, tWeek = 0
  while (tWeek < teachingWeek) {
    if (!breakWeeks.includes(calWeek)) tWeek++
    if (tWeek === teachingWeek) break
    calWeek++
  }
  const weekMon = new Date(startMon)
  weekMon.setDate(startMon.getDate() + (calWeek - 1) * 7)
  const dayIdx = DAY_NAMES.indexOf(dayName)
  weekMon.setDate(weekMon.getDate() + (dayIdx === -1 ? 0 : dayIdx))
  return weekMon.toISOString().split('T')[0]
}

export function isoFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
