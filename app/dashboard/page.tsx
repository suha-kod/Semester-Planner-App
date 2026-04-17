'use client'

import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { isoFromDate } from '@/lib/weeks'
import { HabitFormModal } from '@/components/habits/HabitFormModal'
import { toast } from '@/components/ui/Toast'
import type { Habit } from '@/types'

const WEEK_COLORS = ['#7c5cfc','#60a5fa','#2dd4a0','#f472b6','#f5a623']
const DAY_ABBR    = ['Su','Mo','Tu','We','Th','Fr','Sa']

function getDaysInMonth(year: number, month: number): Date[] {
  const out: Date[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) { out.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return out
}

// Split days into Mon–Sun calendar weeks
function groupIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = []
  let week: Date[] = []
  for (const d of days) {
    if (d.getDay() === 1 && week.length > 0) { weeks.push(week); week = [] }
    week.push(d)
  }
  if (week.length > 0) weeks.push(week)
  return weeks
}

export default function DashboardPage() {
  const habits      = useStore(s => s.habits)
  const checkIns    = useStore(s => s.habitCheckIns)
  const { setHabitCheckIn, updateHabit, deleteHabit } = useStore()

  const todayISO = isoFromDate(new Date())
  const today    = new Date()

  const [monthOffset, setMonthOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)

  const displayYear  = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1).getFullYear()
  const displayMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1).getMonth()
  const monthLabel   = new Date(displayYear, displayMonth, 1).toLocaleDateString('en-AU', { month:'long', year:'numeric' })

  const days  = useMemo(() => getDaysInMonth(displayYear, displayMonth), [displayYear, displayMonth])
  const weeks = useMemo(() => groupIntoWeeks(days), [days])

  // Precompute: which week index each day belongs to
  const dayWeekIdx = useMemo(() => {
    const map: Record<string, number> = {}
    weeks.forEach((w, wi) => w.forEach(d => { map[isoFromDate(d)] = wi }))
    return map
  }, [weeks])

  // CheckIn lookup: habitId → date → count
  const checkInMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    checkIns.forEach(c => { if (!m[c.habitId]) m[c.habitId] = {}; m[c.habitId][c.date] = c.count })
    return m
  }, [checkIns])

  const activeHabits = habits.filter(h => h.active)

  function isChecked(hid: string, date: string) { return (checkInMap[hid]?.[date] ?? 0) >= 1 }
  function toggle(hid: string, date: string) {
    setHabitCheckIn(hid, date, isChecked(hid, date) ? 0 : 1)
  }

  // Month stats (only up to today for current month, full for past)
  const isPastMonth = displayYear < today.getFullYear() || (displayYear === today.getFullYear() && displayMonth < today.getMonth())
  const countDays   = isPastMonth ? days.length : days.filter(d => isoFromDate(d) <= todayISO).length

  const completedCells = checkIns.filter(c => {
    const d = new Date(c.date)
    return d.getFullYear() === displayYear && d.getMonth() === displayMonth && c.count > 0
  }).length

  const maxPossible = activeHabits.length * Math.max(1, countDays)
  const progressPct = maxPossible > 0 ? Math.round(completedCells / maxPossible * 100) : 0

  // Per-habit stats
  const habitStats = useMemo(() => activeHabits.map(h => {
    const done = days.filter(d => isChecked(h.id, isoFromDate(d))).length
    const pct  = countDays > 0 ? Math.round(done / countDays * 100) : 0
    return { h, done, pct }
  }), [activeHabits, days, checkInMap, countDays])

  // Per-day stats
  const dayStats = useMemo(() => days.map(d => {
    const iso = isoFromDate(d)
    const done = activeHabits.filter(h => isChecked(h.id, iso)).length
    const pct  = activeHabits.length > 0 ? Math.round(done / activeHabits.length * 100) : 0
    return { iso, done, notDone: activeHabits.length - done, pct }
  }), [days, activeHabits, checkInMap])

  // Streak helper
  function streak(hid: string): number {
    let s = 0; const d = new Date()
    for (let i = 0; i < 90; i++) {
      if ((checkInMap[hid]?.[isoFromDate(d)] ?? 0) >= 1) s++; else break
      d.setDate(d.getDate() - 1)
    }
    return s
  }

  // SVG area chart data
  const chartPoints = dayStats.map((ds, i) => ({ x: i, y: ds.pct, valid: ds.iso <= todayISO }))

  return (
    <div className="p-6" style={{ maxWidth:'100%' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-10 mb-6 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-light" style={{ color:'var(--text)' }}>{monthLabel}</h1>
          <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>— Habit Tracker —</p>
        </div>

        <div className="flex items-center gap-10">
          <Stat label="Number of habits"  value={String(activeHabits.length)} />
          <Stat label="Completed habits"  value={String(completedCells)} />
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color:'var(--text3)' }}>Progress</div>
            <div className="w-36 h-3 rounded-full overflow-hidden" style={{ background:'var(--bg4)' }}>
              <div className="h-full rounded-full transition-all" style={{ width:`${progressPct}%`, background:'#f5a623' }} />
            </div>
          </div>
          <Stat label="Progress in %"    value={`${progressPct}%`} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={()=>setMonthOffset(o=>o-1)}>← Prev</button>
          {monthOffset !== 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setMonthOffset(0)}>Now</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>setMonthOffset(o=>o+1)}>Next →</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{setEditHabit(null);setShowForm(true)}}>+ Habit</button>
        </div>
      </div>

      {activeHabits.length === 0 ? (
        <div className="text-center py-20" style={{ color:'var(--text3)' }}>
          <div style={{ fontSize:52 }}>📋</div>
          <div className="text-lg font-medium mt-4 mb-2" style={{ color:'var(--text)' }}>No habits yet</div>
          <p className="text-sm mb-6">Add your first daily habit to start tracking.</p>
          <button className="btn btn-primary" onClick={()=>{setEditHabit(null);setShowForm(true)}}>+ Add habit</button>
        </div>
      ) : (
        <>
          {/* ── Habit grid + Analysis ── */}
          <div className="flex gap-5 min-w-0">

            {/* Grid (scrollable) */}
            <div className="flex-1 min-w-0 overflow-x-auto">
              <table style={{ borderCollapse:'collapse', tableLayout:'fixed', minWidth: 160 + days.length * 26 }}>
                <colgroup>
                  <col style={{ width:170 }} />
                  {days.map((_, i) => <col key={i} style={{ width:26 }} />)}
                </colgroup>

                <thead>
                  {/* Week color banners */}
                  <tr>
                    <th />
                    {weeks.map((w, wi) => (
                      <th key={wi} colSpan={w.length} style={{
                        textAlign:'center', fontSize:11, fontWeight:700, padding:'5px 2px',
                        background: WEEK_COLORS[wi % WEEK_COLORS.length] + '28',
                        color: WEEK_COLORS[wi % WEEK_COLORS.length],
                        borderBottom:`2px solid ${WEEK_COLORS[wi % WEEK_COLORS.length]}`,
                      }}>
                        Week {wi + 1}
                      </th>
                    ))}
                  </tr>

                  {/* Day abbreviation */}
                  <tr>
                    <th style={{ textAlign:'left', paddingLeft:8, fontSize:10, fontWeight:600, color:'var(--text3)', paddingBottom:2 }}>My Habits</th>
                    {days.map((d, di) => {
                      const wi = dayWeekIdx[isoFromDate(d)] ?? 0
                      return <th key={di} style={{ textAlign:'center', fontSize:9, fontWeight:500, color:'var(--text3)', background: WEEK_COLORS[wi % WEEK_COLORS.length] + '12', padding:'2px 0' }}>
                        {DAY_ABBR[d.getDay()]}
                      </th>
                    })}
                  </tr>

                  {/* Date number */}
                  <tr>
                    <th />
                    {days.map((d, di) => {
                      const iso = isoFromDate(d)
                      const wi  = dayWeekIdx[iso] ?? 0
                      const isT = iso === todayISO
                      return <th key={di} style={{ textAlign:'center', fontSize:9, fontWeight: isT ? 800 : 400, color: isT ? WEEK_COLORS[wi % WEEK_COLORS.length] : 'var(--text3)', background: WEEK_COLORS[wi % WEEK_COLORS.length] + '12', paddingBottom:4 }}>
                        {d.getDate()}
                      </th>
                    })}
                  </tr>
                </thead>

                <tbody>
                  {/* Habit rows */}
                  {activeHabits.map((h, hi) => (
                    <tr key={h.id} className="group" style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'3px 8px' }}>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize:13 }}>{h.emoji}</span>
                          <span style={{ fontSize:11, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:110 }}>{h.title}</span>
                          <div className="hidden group-hover:flex items-center gap-1 ml-auto flex-shrink-0">
                            <button onClick={()=>{setEditHabit(h);setShowForm(true)}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:10,padding:0,lineHeight:1 }}>✎</button>
                            <button onClick={()=>{deleteHabit(h.id);toast('Deleted','info')}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:10,padding:0,lineHeight:1 }}>✕</button>
                          </div>
                        </div>
                      </td>
                      {days.map((d, di) => {
                        const iso     = isoFromDate(d)
                        const wi      = dayWeekIdx[iso] ?? 0
                        const wc      = WEEK_COLORS[wi % WEEK_COLORS.length]
                        const checked = isChecked(h.id, iso)
                        const future  = iso > todayISO
                        return (
                          <td key={di} style={{ textAlign:'center', padding:'2px 1px', background: wc + '08' }}>
                            <button
                              onClick={() => !future && toggle(h.id, iso)}
                              title={future ? '' : iso}
                              style={{
                                width:18, height:18, borderRadius:3, border:`1px solid ${checked ? wc : 'var(--border2)'}`,
                                background: checked ? wc : 'transparent', cursor:future?'default':'pointer',
                                opacity:future?0.25:1, display:'flex', alignItems:'center', justifyContent:'center',
                                transition:'all 0.12s',
                              }}>
                              {checked && <span style={{ color:'#fff', fontSize:9, lineHeight:1, fontWeight:700 }}>✓</span>}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Footer: Progress % */}
                  <tr style={{ borderTop:'2px solid var(--border2)' }}>
                    <td style={{ fontSize:9, color:'var(--text3)', padding:'3px 8px', fontWeight:700 }}>Progress</td>
                    {dayStats.map((ds, di) => {
                      const wi = dayWeekIdx[ds.iso] ?? 0
                      return <td key={di} style={{ textAlign:'center', fontSize:8, color:'var(--text3)', padding:'1px 0', background: WEEK_COLORS[wi % WEEK_COLORS.length] + '08' }}>
                        {ds.pct}%
                      </td>
                    })}
                  </tr>

                  {/* Footer: Done */}
                  <tr>
                    <td style={{ fontSize:9, color:'var(--text3)', padding:'2px 8px' }}>Done</td>
                    {dayStats.map((ds, di) => {
                      const wi = dayWeekIdx[ds.iso] ?? 0
                      return <td key={di} style={{ textAlign:'center', fontSize:8, color:'#2dd4a0', padding:'1px 0', background: WEEK_COLORS[wi % WEEK_COLORS.length] + '08' }}>
                        {ds.done}
                      </td>
                    })}
                  </tr>

                  {/* Footer: Not Done */}
                  <tr>
                    <td style={{ fontSize:9, color:'var(--text3)', padding:'2px 8px' }}>Not Done</td>
                    {dayStats.map((ds, di) => {
                      const wi = dayWeekIdx[ds.iso] ?? 0
                      return <td key={di} style={{ textAlign:'center', fontSize:8, color:'#f05252', padding:'1px 0', background: WEEK_COLORS[wi % WEEK_COLORS.length] + '08' }}>
                        {ds.notDone}
                      </td>
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Analysis sidebar */}
            <div style={{ width:210, flexShrink:0 }}>
              <div className="text-sm font-semibold mb-4 text-right" style={{ color:'var(--text)' }}>Analysis</div>
              {habitStats.map(({ h, pct }) => (
                <div key={h.id} className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 min-w-0" style={{ flex:'1 1 90px' }}>
                    <span style={{ fontSize:12, flexShrink:0 }}>{h.emoji}</span>
                    <span style={{ fontSize:11, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="overflow-hidden rounded-full" style={{ width:58, height:8, background:'var(--bg4)' }}>
                      <div className="h-full rounded-full" style={{ width:`${pct}%`, background:h.colour }} />
                    </div>
                    <span style={{ fontSize:10, color:'var(--text3)', minWidth:34, textAlign:'right' }}>{pct}%</span>
                  </div>
                </div>
              ))}

              <div style={{ marginTop:20, borderTop:'1px solid var(--border)', paddingTop:16 }}>
                <div className="text-xs mb-3" style={{ color:'var(--text3)' }}>Quick actions</div>
                <button className="btn btn-ghost btn-sm w-full text-xs mb-2" onClick={()=>{
                  const undone = activeHabits.filter(h => !isChecked(h.id, todayISO))
                  undone.forEach(h => setHabitCheckIn(h.id, todayISO, 1))
                  undone.length ? toast(`Marked ${undone.length} done ✓`,'success') : toast('All done today!','info')
                }}>✓ Mark all done today</button>
                {habits.filter(h=>!h.active).length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs mb-1.5" style={{ color:'var(--text3)' }}>Inactive</div>
                    {habits.filter(h=>!h.active).map(h => (
                      <button key={h.id} onClick={()=>updateHabit(h.id,{active:true})} className="btn btn-ghost btn-sm text-xs w-full mb-1" style={{ opacity:0.55 }}>
                        {h.emoji} {h.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Completion chart ── */}
          <div className="mt-5 rounded-xl px-4 pt-4 pb-2" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
            <CompletionChart points={chartPoints} n={days.length} />
          </div>
        </>
      )}

      <HabitFormModal
        open={showForm}
        onClose={()=>{setShowForm(false);setEditHabit(null)}}
        editing={editHabit}
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color:'var(--text3)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color:'var(--text)' }}>{value}</div>
    </div>
  )
}

function CompletionChart({ points, n }: { points: { x: number; y: number; valid: boolean }[]; n: number }) {
  const W = 900, H = 120, PL = 36, PR = 8, PT = 8, PB = 28
  const cW = W - PL - PR, cH = H - PT - PB
  const xS = (i: number) => PL + (n > 1 ? (i / (n - 1)) : 0) * cW
  const yS = (v: number) => PT + cH - (v / 100) * cH
  const valid = points.filter(p => p.valid)
  if (valid.length < 2) return <div style={{ height:60, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'var(--text3)' }}>No data yet this month</div>
  const linePts = valid.map(p => `${xS(p.x)},${yS(p.y)}`).join(' ')
  const linePath = valid.map((p,i)=>`${i===0?'M':'L'}${xS(p.x)} ${yS(p.y)}`).join(' ')
  const area = `${linePath} L${xS(valid[valid.length-1].x)} ${PT+cH} L${xS(valid[0].x)} ${PT+cH}Z`
  const grid = [0,25,50,75,100]
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
      {grid.map(v=>(
        <g key={v}>
          <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)} stroke="var(--border)" strokeWidth={0.5}/>
          <text x={PL-4} y={yS(v)+3} textAnchor="end" fontSize={9} fill="var(--text3)">{v}%</text>
        </g>
      ))}
      <path d={area} fill="#2dd4a0" fillOpacity={0.14}/>
      <path d={linePath} fill="none" stroke="#2dd4a0" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
      {valid.map((p,i)=>(
        i === valid.length-1 && <circle key={i} cx={xS(p.x)} cy={yS(p.y)} r={3} fill="#2dd4a0"/>
      ))}
    </svg>
  )
}
