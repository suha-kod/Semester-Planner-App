// lib/risk.ts

import type { Unit, Assessment, WeeklyLog, RiskResult } from '@/types'
import { daysUntil } from './weeks'

export function computeUnitRisk(
  unit: Unit,
  assessments: Assessment[],
  weeklyLogs: WeeklyLog[],
  currentWeek: number,
): RiskResult {
  let score = 0
  const reasons: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const active = assessments.filter(
    a => a.status !== 'submitted' && a.status !== 'graded' && a.status !== 'complete'
  )

  // Overdue items
  const overdue = active.filter(a => {
    if (!a.dueDate) return false
    return new Date(a.dueDate + 'T00:00:00') < today
  })
  if (overdue.length > 0) {
    score += overdue.length * 25 * (unit.difficulty / 5)
    reasons.push(`${overdue.length} overdue item${overdue.length > 1 ? 's' : ''}`)
  }

  // High-weight items due within 7 days
  const soonHeavy = active.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d >= 0 && d <= 7 && a.weight >= 20
  })
  if (soonHeavy.length > 0) {
    score += soonHeavy.length * 20 * (unit.difficulty / 5)
    reasons.push(`${soonHeavy.length} high-weight item${soonHeavy.length > 1 ? 's' : ''} due this week`)
  }

  // Difficulty contribution (above average = extra pressure)
  score += (unit.difficulty - 5) * 3

  // Weekly completion gap
  const logsToDate = weeklyLogs.filter(l => l.unitId === unit.id && l.week <= currentWeek)
  const totalItems = logsToDate.reduce((s, l) => s + l.items.length, 0)
  const doneItems = logsToDate.reduce((s, l) => s + l.items.filter(i => i.done).length, 0)
  if (totalItems > 0) {
    const rate = doneItems / totalItems
    if (rate < 0.5) {
      score += 20 * (unit.difficulty / 5)
      reasons.push(`Low weekly completion (${Math.round(rate * 100)}%)`)
    }
  }

  // Current mark vs target
  const graded = assessments.filter(
    a => a.mark !== null && a.mark !== undefined
  )
  if (graded.length > 0 && unit.targetMark) {
    const wSum = graded.reduce(
      (s, a) => s + (a.mark! / (a.maxMark || 100)) * 100 * (a.weight || 0), 0
    )
    const wTotal = graded.reduce((s, a) => s + (a.weight || 0), 0)
    if (wTotal > 0) {
      const currentMark = wSum / wTotal
      if (currentMark < unit.targetMark - 15) {
        score += 15
        reasons.push('Current mark below target')
      }
    }
  }

  const level =
    score < 15 ? 'low' :
    score < 35 ? 'medium' :
    score < 60 ? 'high' : 'critical'

  return { score, level, reasons }
}

export function computeCurrentMark(
  assessments: Assessment[]
): number | null {
  const graded = assessments.filter(a => a.mark !== null && a.mark !== undefined)
  if (graded.length === 0) return null
  let wSum = 0, wTotal = 0
  graded.forEach(a => {
    const pct = (a.mark! / (a.maxMark || 100)) * 100
    wSum += pct * (a.weight || 0)
    wTotal += a.weight || 0
  })
  return wTotal > 0 ? wSum / wTotal : null
}

export function computeProjectedMark(
  assessments: Assessment[]
): number | null {
  const graded = assessments.filter(a => a.mark !== null && a.mark !== undefined)
  if (graded.length === 0) return null
  const totalWeight = assessments.reduce((s, a) => s + (a.weight || 0), 0)
  if (totalWeight === 0) return null
  const earnedContrib = graded.reduce(
    (s, a) => s + (a.mark! / (a.maxMark || 100)) * 100 * (a.weight || 0), 0
  )
  const gradedWeight = graded.reduce((s, a) => s + (a.weight || 0), 0)
  const remaining = totalWeight - gradedWeight
  // Project 65% on remaining
  return (earnedContrib + remaining * 65) / totalWeight
}

export function neededMarkForTarget(
  unit: Unit,
  assessments: Assessment[],
): number | null {
  if (!unit.targetMark) return null
  const graded = assessments.filter(a => a.mark !== null && a.mark !== undefined)
  const totalWeight = assessments.reduce((s, a) => s + (a.weight || 0), 0)
  const gradedWeight = graded.reduce((s, a) => s + (a.weight || 0), 0)
  const remaining = totalWeight - gradedWeight
  if (remaining <= 0) return null
  const earned = graded.reduce(
    (s, a) => s + (a.mark! / (a.maxMark || 100)) * 100 * (a.weight || 0), 0
  )
  return (unit.targetMark * totalWeight - earned) / remaining
}
