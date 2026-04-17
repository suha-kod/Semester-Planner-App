// lib/risk.ts

import type { Unit, Assessment, WeeklyLog, RiskResult } from '@/types'
import { daysUntil } from './weeks'

/** Parse "Best N of M" (case-insensitive) from specialRules */
export function parseBestOf(rules: string | null | undefined): { keep: number; total: number } | null {
  if (!rules) return null
  const m = rules.match(/best\s+(\d+)\s+of\s+(\d+)/i)
  if (!m) return null
  const keep = parseInt(m[1]), total = parseInt(m[2])
  if (isNaN(keep) || isNaN(total) || keep <= 0 || total <= 0 || keep > total) return null
  return { keep, total }
}

/**
 * Returns a copy of assessments with effective weights applied for "Best N of M" groups.
 *
 * Rule: the stored weight is the GROUP TOTAL (e.g. 20% for all quizzes).
 * The top N graded by score each count for (groupWeight / N).
 * Graded but not in the top N count for 0.
 * Ungraded slots still count for (groupWeight / N) for projection purposes.
 */
export function resolveEffectiveWeights(assessments: Assessment[]): Assessment[] {
  const groupMap = new Map<string, Assessment[]>()
  const standalone: Assessment[] = []

  for (const a of assessments) {
    const rule = parseBestOf(a.specialRules)
    if (rule) {
      const key = `${a.unitId}||${(a.specialRules ?? '').trim().toLowerCase()}`
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(a)
    } else {
      standalone.push(a)
    }
  }

  const result: Assessment[] = [...standalone]

  for (const group of groupMap.values()) {
    const rule = parseBestOf(group[0].specialRules)!
    const groupWeight = group[0].weight   // stored weight = group total
    const perWeight = groupWeight / rule.keep

    // Sort graded by score % descending to pick top N
    const graded = group
      .filter(a => a.mark !== null && a.mark !== undefined)
      .sort((a, b) => (b.mark! / (b.maxMark || 100)) - (a.mark! / (a.maxMark || 100)))

    const topNIds = new Set(graded.slice(0, rule.keep).map(a => a.id))

    for (const a of group) {
      const isGraded = a.mark !== null && a.mark !== undefined
      // Graded but not in top N → excluded (weight 0)
      const effectiveWeight = (isGraded && !topNIds.has(a.id)) ? 0 : perWeight
      result.push({ ...a, weight: effectiveWeight })
    }
  }

  return result
}

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

  // High-weight items due within 7 days (use effective weights for "best of" groups)
  const resolved = resolveEffectiveWeights(active)
  const soonHeavy = resolved.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d >= 0 && d <= 7 && a.weight >= 10
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

  // Current mark vs target (using effective weights)
  const graded = resolveEffectiveWeights(assessments).filter(
    a => a.mark !== null && a.mark !== undefined && a.weight > 0
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
  const resolved = resolveEffectiveWeights(assessments)
  const graded = resolved.filter(a => a.mark !== null && a.mark !== undefined && a.weight > 0)
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
  const resolved = resolveEffectiveWeights(assessments)
  const graded = resolved.filter(a => a.mark !== null && a.mark !== undefined && a.weight > 0)
  if (graded.length === 0) return null
  const totalWeight = resolved.reduce((s, a) => s + (a.weight || 0), 0)
  if (totalWeight === 0) return null
  const earnedContrib = graded.reduce(
    (s, a) => s + (a.mark! / (a.maxMark || 100)) * 100 * (a.weight || 0), 0
  )
  const gradedWeight = graded.reduce((s, a) => s + (a.weight || 0), 0)
  const remaining = totalWeight - gradedWeight
  return (earnedContrib + remaining * 65) / totalWeight
}

export function neededMarkForTarget(
  unit: Unit,
  assessments: Assessment[],
): number | null {
  if (!unit.targetMark) return null
  const resolved = resolveEffectiveWeights(assessments)
  const graded = resolved.filter(a => a.mark !== null && a.mark !== undefined && a.weight > 0)
  const totalWeight = resolved.reduce((s, a) => s + (a.weight || 0), 0)
  const gradedWeight = graded.reduce((s, a) => s + (a.weight || 0), 0)
  const remaining = totalWeight - gradedWeight
  if (remaining <= 0) return null
  const earned = graded.reduce(
    (s, a) => s + (a.mark! / (a.maxMark || 100)) * 100 * (a.weight || 0), 0
  )
  return (unit.targetMark * totalWeight - earned) / remaining
}

/** Effective weight per quiz for display (e.g. 2.5% for "best 8 of 12" with 20% total) */
export function effectiveWeight(a: Assessment): number {
  const rule = parseBestOf(a.specialRules)
  if (!rule) return a.weight
  return a.weight / rule.keep
}
