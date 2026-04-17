'use client'

import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { weekDateRange, isoFromDate } from '@/lib/weeks'
import { HabitFormModal } from '@/components/habits/HabitFormModal'
import { ConfirmDialog } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import type { Habit } from '@/types'

const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export default function DashboardPage() {
  const profile    = useStore(s => s.profile)
  const units      = useStore(s => s.units)
  const habits     = useStore(s => s.habits)
  const checkIns   = useStore(s => s.habitCheckIns)
  const { setHabitCheckIn, updateHabit, deleteHabit } = useStore()

  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm]     = useState(false)
  const [editHabit, setEditHabit]   = useState<Habit | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)

  const { days } = weekDateRange(weekOffset)
  const todayISO  = isoFromDate(new Date())

  const activeHabits = habits.filter(h => h.active)

  // build lookup: checkInMap[habitId][date] = count
  const checkInMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    checkIns.forEach(c => {
      if (!map[c.habitId]) map[c.habitId] = {}
      map[c.habitId][c.date] = c.count
    })
    return map
  }, [checkIns])

  function isChecked(habitId: string, date: string) {
    return (checkInMap[habitId]?.[date] ?? 0) >= 1
  }

  function toggle(habit: Habit, date: string) {
    const cur = checkInMap[habit.id]?.[date] ?? 0
    setHabitCheckIn(habit.id, date, cur >= 1 ? 0 : 1)
  }

  // Stats
  const weekDates = days.map(isoFromDate)
  const totalPossible = activeHabits.length * 7
  const totalDone     = activeHabits.reduce((sum, h) => sum + weekDates.filter(d => isChecked(h.id, d)).length, 0)
  const weekPct       = totalPossible > 0 ? Math.round(totalDone / totalPossible * 100) : 0

  // Per-habit: compute current streak (consecutive days ending today going back)
  function habitStreak(habitId: string): number {
    let streak = 0
    const d = new Date()
    for (let i = 0; i < 60; i++) {
      const ds = isoFromDate(d)
      if ((checkInMap[habitId]?.[ds] ?? 0) >= 1) { streak++ }
      else break
      d.setDate(d.getDate() - 1)
    }
    return streak
  }

  // Per-habit week completion %
  function habitWeekPct(habitId: string): number {
    const done = weekDates.filter(d => isChecked(habitId, d)).length
    return Math.round(done / 7 * 100)
  }

  // Per-day completion %
  function dayPct(dateISO: string): number {
    if (activeHabits.length === 0) return 0
    const done = activeHabits.filter(h => isChecked(h.id, dateISO)).length
    return Math.round(done / activeHabits.length * 100)
  }

  const bestStreak = activeHabits.reduce((max, h) => Math.max(max, habitStreak(h.id)), 0)

  const monday = days[0]
  const sunday = days[6]
  const weekLabel = `${monday.toLocaleDateString('en-AU', { day:'numeric', month:'short' })} – ${sunday.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}`

  // Colour accent for current week number (cycling through palette)
  const weekNum = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 604800000) + weekOffset
  const weekAccents = ['#7c5cfc','#2dd4a0','#f5a623','#f472b6','#60a5fa','#34d399','#fb923c']
  const weekAccent = weekAccents[((weekNum % 7) + 7) % 7]

  function openEdit(h: Habit) { setEditHabit(h); setShowForm(true) }
  function openAdd() { setEditHabit(null); setShowForm(true) }

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-serif text-4xl font-light" style={{ color:'var(--text)' }}>
            Habit Tracker{profile.name ? `, ${profile.name}` : ''}
          </h1>
          <p className="text-sm mt-1" style={{ color:'var(--text3)' }}>Track your daily academic habits and build consistency</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add habit</button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label:'Active habits',    value: activeHabits.length,          sub:'being tracked',        colour:'var(--accent)' },
          { label:'This week',        value: `${totalDone}/${totalPossible}`, sub:'check-ins completed', colour:'var(--teal)' },
          { label:'Week completion',  value: `${weekPct}%`,                sub:'of all habits',         colour: weekPct>=75?'var(--green)':weekPct>=40?'var(--amber)':'var(--red)' },
          { label:'Best streak',      value: `${bestStreak}d`,             sub:'consecutive days',      colour:'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'16px 20px' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color:'var(--text3)' }}>{s.label}</div>
            <div className="text-3xl font-mono font-light mb-0.5" style={{ color: s.colour }}>{s.value}</div>
            <div className="text-xs" style={{ color:'var(--text3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns:'1fr 280px' }}>
        {/* Main grid */}
        <div>
          {/* Week nav */}
          <div className="flex items-center gap-3 mb-4">
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>← Prev</button>
            <div className="flex-1 text-center">
              <span className="text-sm font-medium px-4 py-1.5 rounded-full" style={{ background:'var(--bg3)', color:'var(--text)', border:`1px solid ${weekAccent}33` }}>
                {weekLabel}
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>Next →</button>
            {weekOffset !== 0 && <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>Today</button>}
          </div>

          {/* Grid table */}
          <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--border)' }}>
            {/* Column headers */}
            <div className="grid" style={{ gridTemplateColumns:'200px repeat(7,1fr) 48px 52px', background: weekAccent + '22', borderBottom:'1px solid var(--border)' }}>
              <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text3)' }}>Habit</div>
              {days.map((d, i) => {
                const ds = isoFromDate(d)
                const isToday = ds === todayISO
                const isFuture = ds > todayISO
                return (
                  <div key={ds} className="py-3 text-center" style={{ opacity: isFuture ? 0.45 : 1 }}>
                    <div className="text-xs font-semibold" style={{ color: isToday ? weekAccent : 'var(--text3)' }}>{DAYS_SHORT[i]}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: isToday ? weekAccent : 'var(--text3)' }}>{d.getDate()}</div>
                  </div>
                )
              })}
              <div className="py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text3)' }}>🔥</div>
              <div className="py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--text3)' }}>%</div>
            </div>

            {/* Habit rows */}
            {activeHabits.length === 0 ? (
              <div className="text-center py-16" style={{ color:'var(--text3)' }}>
                <div className="text-3xl mb-3">📋</div>
                <div className="text-sm font-medium mb-1" style={{ color:'var(--text2)' }}>No habits yet</div>
                <div className="text-xs">Add your first habit to start tracking</div>
                <button className="btn btn-primary btn-sm mt-4" onClick={openAdd}>+ Add habit</button>
              </div>
            ) : activeHabits.map((habit, ri) => {
              const streak = habitStreak(habit.id)
              const pct    = habitWeekPct(habit.id)
              const unit   = units.find(u => u.id === habit.unitId)
              return (
                <div key={habit.id} className="grid group" style={{ gridTemplateColumns:'200px repeat(7,1fr) 48px 52px', borderBottom: ri < activeHabits.length - 1 ? '1px solid var(--border)' : 'none', background:'var(--bg)' }}>
                  {/* Habit name cell */}
                  <div className="flex items-center gap-2 px-4 py-3" style={{ borderRight:'1px solid var(--border)' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: habit.colour }} />
                    <span className="text-base">{habit.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color:'var(--text)' }}>{habit.title}</div>
                      {unit && <div className="text-[10px] truncate" style={{ color:'var(--text3)' }}>{unit.code}</div>}
                    </div>
                    <div className="ml-auto hidden group-hover:flex gap-1">
                      <button onClick={() => openEdit(habit)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background:'var(--bg3)', color:'var(--text3)' }}>✏️</button>
                      <button onClick={() => setDeleteId(habit.id)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background:'var(--bg3)', color:'var(--red)' }}>✕</button>
                    </div>
                  </div>

                  {/* Day cells */}
                  {days.map(d => {
                    const ds      = isoFromDate(d)
                    const checked = isChecked(habit.id, ds)
                    const isToday = ds === todayISO
                    const isFuture = ds > todayISO
                    return (
                      <div key={ds} className="flex items-center justify-center py-3" style={{ borderRight:'1px solid var(--border)' }}>
                        <button
                          disabled={isFuture}
                          onClick={() => toggle(habit, ds)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                          style={{
                            background: checked ? habit.colour : 'var(--bg3)',
                            border: `1.5px solid ${checked ? habit.colour : isToday ? habit.colour + '66' : 'var(--border2)'}`,
                            opacity: isFuture ? 0.3 : 1,
                            cursor: isFuture ? 'default' : 'pointer',
                            boxShadow: checked ? `0 0 8px ${habit.colour}44` : 'none',
                          }}>
                          {checked && <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>✓</span>}
                        </button>
                      </div>
                    )
                  })}

                  {/* Streak */}
                  <div className="flex items-center justify-center py-3" style={{ borderRight:'1px solid var(--border)' }}>
                    <span className="text-xs font-mono font-semibold" style={{ color: streak >= 7 ? 'var(--amber)' : streak >= 3 ? 'var(--teal)' : 'var(--text3)' }}>
                      {streak > 0 ? streak : '—'}
                    </span>
                  </div>

                  {/* Week % */}
                  <div className="flex items-center justify-center py-3">
                    <span className="text-xs font-mono" style={{ color: pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--accent)' : 'var(--text3)' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Footer: per-day completion % */}
            {activeHabits.length > 0 && (
              <div className="grid" style={{ gridTemplateColumns:'200px repeat(7,1fr) 48px 52px', background:'var(--bg3)', borderTop:'1px solid var(--border)' }}>
                <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color:'var(--text3)' }}>Day %</div>
                {days.map(d => {
                  const ds  = isoFromDate(d)
                  const pct = dayPct(ds)
                  return (
                    <div key={ds} className="py-2 text-center">
                      <div className="text-xs font-mono" style={{ color: pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--accent)' : 'var(--text3)' }}>
                        {pct}%
                      </div>
                    </div>
                  )
                })}
                <div />
                <div className="py-2 text-center text-xs font-mono font-semibold" style={{ color: weekPct >= 70 ? 'var(--green)' : weekPct >= 40 ? 'var(--accent)' : 'var(--red)' }}>
                  {weekPct}%
                </div>
              </div>
            )}
          </div>

          {/* Inactive habits toggle */}
          {habits.filter(h => !h.active).length > 0 && (
            <div className="mt-4">
              <div className="text-xs mb-2" style={{ color:'var(--text3)' }}>Inactive habits</div>
              <div className="flex flex-wrap gap-2">
                {habits.filter(h => !h.active).map(h => (
                  <button key={h.id} onClick={() => updateHabit(h.id, { active: true })}
                    className="btn btn-ghost btn-sm text-xs" style={{ opacity:0.5 }}>
                    {h.emoji} {h.title} (reactivate)
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Analysis sidebar */}
        <div>
          <div className="card mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color:'var(--text3)' }}>Analysis</div>
            {activeHabits.length === 0
              ? <p className="text-xs" style={{ color:'var(--text3)' }}>Add habits to see analysis.</p>
              : activeHabits.map(h => {
                  const pct  = habitWeekPct(h.id)
                  const str  = habitStreak(h.id)
                  const unit = units.find(u => u.id === h.unitId)
                  return (
                    <div key={h.id} className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{h.emoji}</span>
                          <span className="text-xs font-medium truncate" style={{ color:'var(--text)' }}>{h.title}</span>
                          {unit && <span className="text-[10px] px-1 rounded" style={{ background:'var(--bg4)', color:'var(--text3)' }}>{unit.code}</span>}
                        </div>
                        <span className="text-xs font-mono ml-2 flex-shrink-0" style={{ color: h.colour }}>{pct}%</span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--bg4)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background: h.colour }} />
                      </div>
                      {str > 0 && <div className="text-[10px] mt-0.5" style={{ color:'var(--text3)' }}>🔥 {str} day streak</div>}
                    </div>
                  )
                })
            }
          </div>

          {/* Quick actions */}
          <div className="card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--text3)' }}>Quick actions</div>
            <button className="btn btn-secondary btn-sm w-full mb-2" onClick={openAdd}>+ New habit</button>
            {activeHabits.length > 0 && (
              <button className="btn btn-ghost btn-sm w-full text-xs" onClick={() => {
                const undone = activeHabits.filter(h => !isChecked(h.id, todayISO))
                undone.forEach(h => setHabitCheckIn(h.id, todayISO, 1))
                if (undone.length) toast(`Marked ${undone.length} habit${undone.length > 1 ? 's' : ''} done for today`, 'success')
                else toast('All habits already done today!', 'info')
              }}>
                ✓ Mark all done today
              </button>
            )}
          </div>
        </div>
      </div>

      <HabitFormModal open={showForm} onClose={() => { setShowForm(false); setEditHabit(null) }} editing={editHabit} />
      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) { deleteHabit(deleteId); toast('Habit deleted', 'info') }; setDeleteId(null) }}
        title="Delete habit"
        message="Delete this habit and all its check-in history?"
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
