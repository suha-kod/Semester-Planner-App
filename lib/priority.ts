// lib/priority.ts

import type { Assessment, Unit, WeeklyLog, PriorityItem } from '@/types'
import { daysUntil } from './weeks'

export function buildPriorityList(
  assessments: Assessment[],
  units: Unit[],
  weeklyLogs: WeeklyLog[],
  currentWeek: number,
): PriorityItem[] {
  const items: PriorityItem[] = []

  assessments.forEach(a => {
    if (['submitted', 'graded', 'complete'].includes(a.status)) return
    const days = daysUntil(a.dueDate)
    if (days === null) return
    const unit = units.find(u => u.id === a.unitId)
    const diff = unit?.difficulty ?? 5
    const score = (21 - Math.max(0, days)) * 5 + a.weight * 0.5 + diff * 2
    items.push({
      name: a.name,
      meta: `${unit?.code ?? '?'} · Due ${days < 0 ? 'overdue' : days === 0 ? 'today' : `in ${days}d`} · ${a.weight}% weight`,
      score,
      urgency: days < 0 || days <= 2 ? 'urgent' : days <= 7 ? 'soon' : '',
      unitCode: unit?.code,
    })
  })

  // Behind on weekly tasks
  units.forEach(u => {
    const logs = weeklyLogs.filter(l => l.unitId === u.id && l.week === currentWeek)
    const total = logs.reduce((s, l) => s + l.items.length, 0)
    const done = logs.reduce((s, l) => s + l.items.filter(i => i.done).length, 0)
    if (total > 0 && done / total < 0.3) {
      items.push({
        name: `Week ${currentWeek} tasks — ${u.name}`,
        meta: `${done}/${total} completed · difficulty ${u.difficulty}/10`,
        score: 30 + u.difficulty * 3,
        urgency: 'soon',
        unitCode: u.code,
      })
    }
  })

  return items.sort((a, b) => b.score - a.score)
}

export function generateRecommendations(
  units: Unit[],
  assessments: Assessment[],
  weeklyLogs: WeeklyLog[],
  currentWeek: number,
): string[] {
  const recs: string[] = []

  if (units.length === 0) {
    return ['Add your units and assessments to get smart recommendations.']
  }

  // Overdue items
  const overdue = assessments.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d < 0 && !['submitted', 'graded', 'complete'].includes(a.status)
  })
  if (overdue.length > 0) {
    const unit = units.find(u => u.id === overdue[0].unitId)
    recs.push(`🔴 You have ${overdue.length} overdue item${overdue.length > 1 ? 's' : ''}. "${overdue[0].name}"${unit ? ` (${unit.code})` : ''} needs urgent attention.`)
  }

  // Due within 3 days
  const urgent = assessments.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d >= 0 && d <= 3 && !['submitted', 'graded', 'complete'].includes(a.status)
  }).sort((a, b) => daysUntil(a.dueDate)! - daysUntil(b.dueDate)!)
  if (urgent.length > 0) {
    const unit = units.find(u => u.id === urgent[0].unitId)
    const d = daysUntil(urgent[0].dueDate)
    recs.push(`📅 "${urgent[0].name}"${unit ? ` (${unit.code})` : ''} is due ${d === 0 ? 'TODAY' : `in ${d} day${d !== 1 ? 's' : ''}`}. This should be your top priority.`)
  }

  // Behind on weekly tasks
  const behindUnits = units.filter(u => {
    const logs = weeklyLogs.filter(l => l.unitId === u.id && l.week === currentWeek)
    const total = logs.reduce((s, l) => s + l.items.length, 0)
    const done = logs.reduce((s, l) => s + l.items.filter(i => i.done).length, 0)
    return total > 0 && done / total < 0.4
  })
  if (behindUnits.length > 0) {
    recs.push(`📚 You're behind on week ${currentWeek} for ${behindUnits.length} unit${behindUnits.length > 1 ? 's' : ''}. Catching up now prevents compounding gaps.`)
  }

  if (recs.length === 0) {
    recs.push('✅ Looking solid! Stay consistent on weekly tasks and keep ahead of deadlines.')
  }

  return recs
}
