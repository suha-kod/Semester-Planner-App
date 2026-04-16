'use client'

import { useMemo } from 'react'
import { useStore, useActiveSemester } from '@/lib/store'
import { currentWeekNumber, daysUntil, fmtDate, isoFromDate } from '@/lib/weeks'
import { computeUnitRisk, computeCurrentMark } from '@/lib/risk'
import { buildPriorityList, generateRecommendations } from '@/lib/priority'
import { StatCard, RiskBadge, StatusBadge, CountdownChip, EmptyState, Alert, SectionHeading, ProgressBar } from '@/components/ui/index'
import { StudyHoursModal } from '@/components/dashboard/StudyHoursModal'
import { useState } from 'react'
import Link from 'next/link'

export default function DashboardPage() {
  const profile = useStore(s => s.profile)
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const weeklyLogs = useStore(s => s.weeklyLogs)
  const studyHours = useStore(s => s.studyHours)
  const semester = useActiveSemester()
  const [showHoursModal, setShowHoursModal] = useState(false)

  const curWeek = currentWeekNumber(semester)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Stats
  const today = new Date(); today.setHours(0,0,0,0)
  const twoWeeks = new Date(today); twoWeeks.setDate(twoWeeks.getDate() + 14)

  const due14 = assessments.filter(a => {
    if (!a.dueDate) return false
    const d = new Date(a.dueDate + 'T00:00:00')
    return d >= today && d <= twoWeeks && !['submitted','graded','complete'].includes(a.status)
  }).length

  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() || 7) - 1))
  const weekHours = studyHours
    .filter(h => new Date(h.date + 'T00:00:00') >= weekStart)
    .reduce((s, h) => s + h.hours, 0)

  const totalItems = weeklyLogs.filter(l => l.week <= curWeek).reduce((s,l) => s + l.items.length, 0)
  const doneItems  = weeklyLogs.filter(l => l.week <= curWeek).reduce((s,l) => s + l.items.filter(i=>i.done).length, 0)
  const overallPct = totalItems > 0 ? Math.round(doneItems / totalItems * 100) : null

  // Overdue alerts
  const overdue = assessments.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d < 0 && !['submitted','graded','complete'].includes(a.status)
  })

  // AI recs
  const recs = useMemo(() => generateRecommendations(units, assessments, weeklyLogs, curWeek), [units, assessments, weeklyLogs, curWeek])

  // Unit risk list
  const unitRisks = useMemo(() =>
    units.map(u => ({
      unit: u,
      risk: computeUnitRisk(u, assessments.filter(a => a.unitId === u.id), weeklyLogs, curWeek),
      mark: computeCurrentMark(assessments.filter(a => a.unitId === u.id)),
    })).sort((a,b) => b.risk.score - a.risk.score),
  [units, assessments, weeklyLogs, curWeek])

  // Upcoming assessments
  const upcoming = assessments
    .filter(a => { const d = daysUntil(a.dueDate); return d !== null && d >= 0 && d <= 21 && !['submitted','graded','complete'].includes(a.status) })
    .sort((a,b) => daysUntil(a.dueDate)! - daysUntil(b.dueDate)!)
    .slice(0, 6)

  // Priority list
  const priorities = useMemo(() => buildPriorityList(assessments, units, weeklyLogs, curWeek).slice(0,5), [assessments, units, weeklyLogs, curWeek])

  // Week completion per unit
  const weekUnits = units.filter(u => weeklyLogs.some(l => l.unitId === u.id && l.week === curWeek))

  // Last 7 days hours
  const last7 = Array.from({length:7},(_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i)
    const ds = isoFromDate(d)
    return { label: d.toLocaleDateString('en-AU',{weekday:'short'}), hours: studyHours.filter(h=>h.date===ds).reduce((s,h)=>s+h.hours,0) }
  })
  const maxHours = Math.max(...last7.map(d=>d.hours), 1)

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-serif text-4xl font-light" style={{ color: 'var(--text)' }}>
            {greeting}{profile.name ? `, ${profile.name}` : ''}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>{dateStr}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowHoursModal(true)}>+ Log hours</button>
          <Link href="/planner" className="btn btn-primary btn-sm">View planner →</Link>
        </div>
      </div>

      {/* Alerts */}
      {overdue.length > 0 && (
        <Alert type="danger">
          🚨 <strong>{overdue.length} overdue assessment{overdue.length > 1 ? 's' : ''}</strong> — {overdue.map(a=>a.name).join(', ')}
        </Alert>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <StatCard label="Units" value={units.length} sub="enrolled this semester" />
        <StatCard label="Due in 14 days" value={due14} colour="amber" sub="assessments" />
        <StatCard label="Study this week" value={`${weekHours.toFixed(1)}h`} colour="teal" sub={`of ${profile.weeklyHoursTarget}h target`} />
        <StatCard label="Overall progress" value={overallPct !== null ? `${overallPct}%` : '—'} colour="accent" sub="weighted completion" />
      </div>

      {/* Main grid */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div>
          {/* AI Recommendations */}
          <div className="rounded-xl p-5 mb-5" style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.1) 0%, rgba(45,212,160,0.05) 100%)', border: '1px solid rgba(124,92,252,0.25)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--accent)' }}>⚡ Smart recommendations</div>
            {recs.map((r,i) => <p key={i} className="text-sm mb-2" style={{ color: 'var(--text)', lineHeight: 1.6 }}>{r}</p>)}
            <div className="flex gap-2 mt-3">
              <Link href="/assessments" className="btn btn-ghost btn-sm">View tasks →</Link>
              <Link href="/planner" className="btn btn-ghost btn-sm">Open planner →</Link>
            </div>
          </div>

          {/* Unit risk */}
          <div className="card mb-5">
            <SectionHeading action={<Link href="/units" className="btn btn-ghost btn-sm">View all →</Link>}>Unit risk overview</SectionHeading>
            {units.length === 0
              ? <EmptyState icon="📚" title="No units yet" description="Add your units to see risk analysis" action={<Link href="/units" className="btn btn-primary btn-sm">Go to Units</Link>} />
              : unitRisks.map(({ unit, risk, mark }) => {
                const logs = weeklyLogs.filter(l => l.unitId === unit.id && l.week <= curWeek)
                const tot = logs.reduce((s,l)=>s+l.items.length,0)
                const don = logs.reduce((s,l)=>s+l.items.filter(i=>i.done).length,0)
                const pct = tot > 0 ? Math.round(don/tot*100) : null
                return (
                  <div key={unit.id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 3, height: 36, borderRadius: 2, background: risk.level === 'low' ? 'var(--green)' : risk.level === 'medium' ? 'var(--amber)' : 'var(--red)', flexShrink: 0 }} />
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{unit.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{unit.code} · {risk.reasons[0] || 'On track'}</div>
                    </div>
                    <div className="text-right">
                      <RiskBadge level={risk.level} />
                      {pct !== null && <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>{pct}% complete</div>}
                      {mark !== null && <div className="text-xs font-mono" style={{ color: 'var(--teal)' }}>{mark.toFixed(1)}%</div>}
                    </div>
                  </div>
                )
              })
            }
          </div>

          {/* Upcoming assessments */}
          <div className="card">
            <SectionHeading action={<Link href="/assessments" className="btn btn-ghost btn-sm">View all →</Link>}>Upcoming assessments</SectionHeading>
            {upcoming.length === 0
              ? <p className="text-sm text-center py-5" style={{ color: 'var(--text3)' }}>No assessments due in the next 21 days.</p>
              : upcoming.map(a => {
                const unit = units.find(u => u.id === a.unitId)
                return (
                  <Link key={a.id} href="/assessments" className="flex items-center gap-3 p-3 rounded-xl mb-2 transition-colors" style={{ background: 'var(--bg3)', border: '1px solid transparent', textDecoration: 'none' }}>
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{unit?.code} · {a.weight}% weight</div>
                    </div>
                    <CountdownChip dateStr={a.dueDate} />
                    <StatusBadge status={a.status} />
                  </Link>
                )
              })
            }
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* What to do next */}
          <div className="card mb-4">
            <SectionHeading>What to do next</SectionHeading>
            {priorities.length === 0
              ? <p className="text-xs" style={{ color: 'var(--text3)' }}>Nothing urgent right now. Keep it up!</p>
              : priorities.map((p, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl mb-2" style={{ background: 'var(--bg3)', borderLeft: `2px solid ${p.urgency === 'urgent' ? 'var(--red)' : p.urgency === 'soon' ? 'var(--amber)' : 'var(--accent)'}` }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{p.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{p.meta}</div>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Week completion */}
          <div className="card mb-4">
            <SectionHeading>Week {curWeek} completion</SectionHeading>
            {weekUnits.length === 0
              ? <p className="text-xs" style={{ color: 'var(--text3)' }}>No weekly tasks configured yet.</p>
              : weekUnits.map(u => {
                const logs = weeklyLogs.filter(l => l.unitId === u.id && l.week === curWeek)
                const tot = logs.reduce((s,l)=>s+l.items.length,0)
                const don = logs.reduce((s,l)=>s+l.items.filter(i=>i.done).length,0)
                const pct = tot > 0 ? Math.round(don/tot*100) : 0
                return (
                  <div key={u.id} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text2)' }}>{u.code}</span>
                      <span className="font-mono" style={{ color: pct>=80?'var(--green)':pct>=50?'var(--accent)':'var(--amber)' }}>{don}/{tot}</span>
                    </div>
                    <ProgressBar value={pct} colour={pct>=80?'green':pct>=50?'accent':'amber'} />
                  </div>
                )
              })
            }
          </div>

          {/* Study hours mini chart */}
          <div className="card">
            <SectionHeading action={<button className="btn btn-ghost btn-sm" onClick={() => setShowHoursModal(true)}>+ Log</button>}>Study hours</SectionHeading>
            <div className="flex items-end gap-1" style={{ height: 80 }}>
              {last7.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-sm relative" style={{ height: 64, background: 'var(--bg4)' }}>
                    <div className="absolute bottom-0 left-0 right-0 rounded-sm transition-all" style={{ height: `${(d.hours/maxHours)*100}%`, background: 'var(--accent)', opacity: 0.75 }} />
                  </div>
                  <span className="text-[9px]" style={{ color: 'var(--text3)' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <StudyHoursModal open={showHoursModal} onClose={() => setShowHoursModal(false)} />
    </div>
  )
}
