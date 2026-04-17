'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { isoFromDate } from '@/lib/weeks'
import { HabitFormModal } from '@/components/habits/HabitFormModal'
import { toast } from '@/components/ui/Toast'
import type { Habit } from '@/types'

const WEEK_COLORS = ['#7c5cfc','#60a5fa','#2dd4a0','#f472b6','#f5a623']
const DAY_ABBR    = ['Su','Mo','Tu','We','Th','Fr','Sa']

function addDays(base: Date, n: number): Date {
  const d = new Date(base); d.setDate(d.getDate() + n); return d
}
function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

// ─── MoodPicker ──────────────────────────────────────────────────────────────
function MoodPicker({ value, onPick, weekColor, isFuture }: {
  value: number | null; onPick: (v: number) => void; weekColor: string; isFuture: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (isFuture) return (
    <div style={{ width:20, height:20, borderRadius:3, border:'1px solid var(--border)', opacity:0.2, margin:'0 auto' }} />
  )
  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:20, height:20, borderRadius:3, fontSize:9, fontWeight:700, cursor:'pointer',
        background: value ? weekColor + '30' : 'transparent',
        border: `1px solid ${value ? weekColor : 'var(--border2)'}`,
        color: value ? 'var(--text)' : 'var(--text3)',
      }}>
        {value ?? '—'}
      </button>
      {open && (
        <div style={{
          position:'absolute', top:24, left:'50%', transform:'translateX(-50%)',
          zIndex:100, background:'var(--bg2)', border:'1px solid var(--border2)',
          borderRadius:8, padding:6, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:3,
          boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => { onPick(n); setOpen(false) }} style={{
              width:26, height:26, borderRadius:5, fontSize:11, cursor:'pointer',
              background: value === n ? weekColor : 'var(--bg4)',
              border: `1px solid ${value === n ? weekColor : 'var(--border)'}`,
              color: 'var(--text)', fontWeight: value === n ? 700 : 400,
            }}>{n}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SVG Charts ──────────────────────────────────────────────────────────────
function AreaChart({ data, n }: { data: number[]; n: number }) {
  const W=900,H=110,PL=36,PR=8,PT=8,PB=24
  const cW=W-PL-PR, cH=H-PT-PB
  const xS=(i:number)=>PL+(n>1?i/(n-1):0)*cW
  const yS=(v:number)=>PT+cH-(v/100)*cH
  const valid = data.map((v,i)=>({v,i})).filter(p=>p.v>0)
  if (valid.length < 2) return <div style={{height:50,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--text3)'}}>No data yet</div>
  const line = valid.map((p,i)=>`${i===0?'M':'L'}${xS(p.i)} ${yS(p.v)}`).join(' ')
  const area = `${line} L${xS(valid[valid.length-1].i)} ${PT+cH} L${xS(valid[0].i)} ${PT+cH}Z`
  const grid = [0,25,50,75,100]
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      {grid.map(v=>(
        <g key={v}>
          <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)} stroke="var(--border)" strokeWidth={0.5}/>
          <text x={PL-4} y={yS(v)+3} textAnchor="end" fontSize={9} fill="var(--text3)">{v}%</text>
        </g>
      ))}
      <path d={area} fill="#2dd4a0" fillOpacity={0.13}/>
      <path d={line} fill="none" stroke="#2dd4a0" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function DualLineChart({ moodData, motData, n }: { moodData: number[]; motData: number[]; n: number }) {
  const W=900,H=120,PL=36,PR=80,PT=10,PB=24
  const cW=W-PL-PR, cH=H-PT-PB
  const xS=(i:number)=>PL+(n>1?i/(n-1):0)*cW
  const yS=(v:number)=>PT+cH-(v/10)*cH
  const moodPts  = moodData.map((v,i)=>({v,i})).filter(p=>p.v>0)
  const motPts   = motData.map((v,i)=>({v,i})).filter(p=>p.v>0)
  const grid = [0,2,4,6,8,10]
  const moodLine = moodPts.map((p,i)=>`${i===0?'M':'L'}${xS(p.i)} ${yS(p.v)}`).join(' ')
  const motLine  = motPts.map((p,i)=>`${i===0?'M':'L'}${xS(p.i)} ${yS(p.v)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      {grid.map(v=>(
        <g key={v}>
          <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)} stroke="var(--border)" strokeWidth={0.5}/>
          <text x={PL-4} y={yS(v)+3} textAnchor="end" fontSize={9} fill="var(--text3)">{v}</text>
        </g>
      ))}
      {moodPts.length>=2 && <path d={moodLine} fill="none" stroke="#60a5fa" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>}
      {motPts.length>=2  && <path d={motLine}  fill="none" stroke="#2dd4a0" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>}
      {/* Legend */}
      <circle cx={W-PR+8} cy={PT+8}  r={4} fill="#60a5fa"/>
      <text   x={W-PR+15} y={PT+12} fontSize={9} fill="var(--text3)">Mood</text>
      <circle cx={W-PR+8} cy={PT+24} r={4} fill="#2dd4a0"/>
      <text   x={W-PR+15} y={PT+28} fontSize={9} fill="var(--text3)">Motivation</text>
    </svg>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const profile     = useStore(s => s.profile)
  const habits      = useStore(s => s.habits)
  const checkIns    = useStore(s => s.habitCheckIns)
  const moodEntries = useStore(s => s.moodEntries)
  const { setHabitCheckIn, updateHabit, deleteHabit, setMoodEntry, updateProfile } = useStore()

  const [showForm, setShowForm]   = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [blockOffset, setBlockOffset] = useState<number>(() => {
    const start = new Date(profile.habitStartDate || new Date().toISOString().split('T')[0])
    const days  = diffDays(new Date(), start)
    return Math.max(0, Math.floor(days / 35))
  })

  const todayISO = isoFromDate(new Date())
  const startDate = useMemo(() => new Date(profile.habitStartDate || todayISO), [profile.habitStartDate])

  // 35 days for current block (5 weeks × 7 days)
  const blockStartDate = useMemo(() => addDays(startDate, blockOffset * 35), [startDate, blockOffset])
  const days = useMemo(() => Array.from({ length: 35 }, (_, i) => addDays(blockStartDate, i)), [blockStartDate])

  // 5 weeks, each with global week number
  const weeks = useMemo(() => Array.from({ length: 5 }, (_, wi) => ({
    days: days.slice(wi * 7, wi * 7 + 7),
    weekNum: blockOffset * 5 + wi + 1,
    color: WEEK_COLORS[(blockOffset * 5 + wi) % WEEK_COLORS.length],
  })), [days, blockOffset])

  // Precompute day → week index
  const dayWeekMap = useMemo(() => {
    const m: Record<string, { wi: number; color: string }> = {}
    weeks.forEach((w, wi) => w.days.forEach(d => { m[isoFromDate(d)] = { wi, color: w.color } }))
    return m
  }, [weeks])

  // Check-in lookup
  const checkInMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    checkIns.forEach(c => { if (!m[c.habitId]) m[c.habitId] = {}; m[c.habitId][c.date] = c.count })
    return m
  }, [checkIns])

  // Mood lookup
  const moodMap = useMemo(() => {
    const m: Record<string, { mood: number; motivation: number }> = {}
    moodEntries.forEach(e => { m[e.date] = { mood: e.mood, motivation: e.motivation } })
    return m
  }, [moodEntries])

  const activeHabits = habits.filter(h => h.active)

  function isChecked(hid: string, date: string) { return (checkInMap[hid]?.[date] ?? 0) >= 1 }
  function toggle(hid: string, date: string) { setHabitCheckIn(hid, date, isChecked(hid, date) ? 0 : 1) }

  // ── Stats ──
  const pastDays = days.filter(d => isoFromDate(d) <= todayISO)
  const completedCells = checkIns.filter(c => {
    const info = dayWeekMap[c.date]
    return info !== undefined && c.count > 0
  }).length
  const maxPossible = activeHabits.length * pastDays.length
  const progressPct = maxPossible > 0 ? Math.round(completedCells / maxPossible * 100) : 0

  // Per-habit analysis
  const habitStats = useMemo(() => activeHabits.map(h => {
    const done = pastDays.filter(d => isChecked(h.id, isoFromDate(d))).length
    const pct  = pastDays.length > 0 ? Math.round(done / pastDays.length * 100) : 0
    return { h, pct }
  }), [activeHabits, pastDays, checkInMap])

  // Per-day habit stats
  const dayStats = useMemo(() => days.map(d => {
    const iso  = isoFromDate(d)
    const done = activeHabits.filter(h => isChecked(h.id, iso)).length
    return { iso, done, notDone: activeHabits.length - done, pct: activeHabits.length ? Math.round(done / activeHabits.length * 100) : 0 }
  }), [days, activeHabits, checkInMap])

  // Streak
  function streak(hid: string): number {
    let s=0; const d=new Date()
    for (let i=0;i<90;i++) {
      if ((checkInMap[hid]?.[isoFromDate(d)] ?? 0)>=1) s++; else break
      d.setDate(d.getDate()-1)
    }
    return s
  }

  // ── Mental State ──
  const moodChartData  = days.map(d => moodMap[isoFromDate(d)]?.mood ?? 0)
  const motChartData   = days.map(d => moodMap[isoFromDate(d)]?.motivation ?? 0)
  const scoreData      = days.map(d => {
    const e = moodMap[isoFromDate(d)]
    return e ? Math.round((e.mood + e.motivation) / 20 * 100) : 0
  })

  // Per-week mental state analysis
  const weekMentalStats = weeks.map(w => {
    const entries = w.days.map(d => moodMap[isoFromDate(d)]).filter(Boolean) as { mood:number; motivation:number }[]
    const moodAvg = entries.length ? entries.reduce((s,e)=>s+e.mood,0)/entries.length : 0
    const motAvg  = entries.length ? entries.reduce((s,e)=>s+e.motivation,0)/entries.length : 0
    const moodPct = Math.round(moodAvg / 10 * 100)
    const motPct  = Math.round(motAvg  / 10 * 100)
    return { weekNum: w.weekNum, color: w.color, moodPct, motPct, hasData: entries.length > 0 }
  })

  // Period label
  const periodStart = days[0].toLocaleDateString('en-AU', { day:'numeric', month:'short' })
  const periodEnd   = days[34].toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })
  const periodLabel = `${periodStart} – ${periodEnd}`
  const weeksLabel  = `Weeks ${blockOffset*5+1}–${blockOffset*5+5}`

  // Habit area chart (% per day, only up to today)
  const habitChartData = dayStats.map((ds,i) => isoFromDate(days[i]) <= todayISO ? ds.pct : 0)

  return (
    <div className="p-6" style={{ maxWidth:'100%' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light" style={{ color:'var(--text)' }}>{periodLabel}</h1>
          <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{weeksLabel} — Habit Tracker</p>
        </div>
        <div className="flex items-center gap-8">
          <Stat label="Number of habits"  value={String(activeHabits.length)} />
          <Stat label="Completed habits"  value={String(completedCells)} />
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color:'var(--text3)' }}>Progress</div>
            <div className="w-32 h-3 rounded-full overflow-hidden" style={{ background:'var(--bg4)' }}>
              <div className="h-full rounded-full transition-all" style={{ width:`${progressPct}%`, background:'#f5a623' }}/>
            </div>
          </div>
          <Stat label="Progress in %" value={`${progressPct}%`} />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={()=>setBlockOffset(o=>Math.max(0,o-1))}>← Prev</button>
          {blockOffset !== Math.max(0, Math.floor(diffDays(new Date(), startDate) / 35)) && (
            <button className="btn btn-ghost btn-sm" onClick={()=>setBlockOffset(Math.max(0,Math.floor(diffDays(new Date(),startDate)/35)))}>Now</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={()=>setBlockOffset(o=>o+1)}>Next →</button>
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
          {/* ── My Habits section ── */}
          <GridSection title="My Habits">
            <HabitGrid
              weeks={weeks}
              days={days}
              dayWeekMap={dayWeekMap}
              activeHabits={activeHabits}
              todayISO={todayISO}
              isChecked={isChecked}
              toggle={toggle}
              dayStats={dayStats}
              onEdit={h=>{setEditHabit(h);setShowForm(true)}}
              onDelete={hid=>{deleteHabit(hid);toast('Deleted','info')}}
            />
            {/* Analysis sidebar */}
            <AnalysisSidebar>
              {habitStats.map(({ h, pct }) => (
                <AnalysisRow key={h.id} emoji={h.emoji} label={h.title} pct={pct} color={h.colour}
                  sub={streak(h.id) > 0 ? `🔥 ${streak(h.id)}d` : undefined} />
              ))}
              <div style={{ marginTop:16, borderTop:'1px solid var(--border)', paddingTop:12 }}>
                <button className="btn btn-ghost btn-sm w-full text-xs" onClick={()=>{
                  const undone = activeHabits.filter(h=>!isChecked(h.id,todayISO))
                  undone.forEach(h=>setHabitCheckIn(h.id,todayISO,1))
                  undone.length ? toast(`Marked ${undone.length} done ✓`,'success') : toast('All done today!','info')
                }}>✓ Mark all done today</button>
                {habits.filter(h=>!h.active).length>0 && (
                  <div className="mt-2">
                    <div className="text-xs mb-1" style={{ color:'var(--text3)' }}>Inactive</div>
                    {habits.filter(h=>!h.active).map(h=>(
                      <button key={h.id} onClick={()=>updateHabit(h.id,{active:true})} className="btn btn-ghost btn-sm text-xs w-full mb-1" style={{ opacity:0.55 }}>
                        {h.emoji} {h.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </AnalysisSidebar>
          </GridSection>

          {/* Habit completion chart */}
          <div className="mt-4 rounded-xl px-4 pt-3 pb-2" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
            <AreaChart data={habitChartData} n={35} />
          </div>

          {/* ── Mental State section ── */}
          <div className="mt-8 mb-2">
            <h2 className="font-serif text-2xl font-light" style={{ color:'var(--text)' }}>Mental State</h2>
            <p className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>Track your daily mood and motivation (tap any cell to rate 1–10)</p>
          </div>

          <GridSection title="Mental State">
            <MentalStateGrid
              weeks={weeks}
              days={days}
              dayWeekMap={dayWeekMap}
              todayISO={todayISO}
              moodMap={moodMap}
              scoreData={scoreData}
              setMoodEntry={setMoodEntry}
            />
            {/* Mental analysis sidebar */}
            <AnalysisSidebar>
              <div className="text-xs font-semibold mb-2" style={{ color:'var(--text3)' }}>Mood</div>
              {weekMentalStats.map(w => (
                <div key={`mood-${w.weekNum}`} className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color:'var(--text3)' }}>Week {w.weekNum}</span>
                    <span className="text-xs font-mono" style={{ color: w.color }}>{w.hasData ? `${w.moodPct}%` : '—'}</span>
                  </div>
                  <div className="overflow-hidden rounded-full" style={{ height:7, background:'var(--bg4)' }}>
                    <div className="h-full rounded-full" style={{ width:`${w.moodPct}%`, background: w.color }} />
                  </div>
                </div>
              ))}
              <div className="text-xs font-semibold mt-4 mb-2" style={{ color:'var(--text3)' }}>Motivation</div>
              {weekMentalStats.map(w => (
                <div key={`mot-${w.weekNum}`} className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color:'var(--text3)' }}>Week {w.weekNum}</span>
                    <span className="text-xs font-mono" style={{ color: w.color }}>{w.hasData ? `${w.motPct}%` : '—'}</span>
                  </div>
                  <div className="overflow-hidden rounded-full" style={{ height:7, background:'var(--bg4)' }}>
                    <div className="h-full rounded-full" style={{ width:`${w.motPct}%`, background: w.color }} />
                  </div>
                </div>
              ))}
            </AnalysisSidebar>
          </GridSection>

          {/* Dual line chart */}
          <div className="mt-4 rounded-xl px-4 pt-3 pb-2" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
            <DualLineChart moodData={moodChartData} motData={motChartData} n={35} />
          </div>
        </>
      )}

      <HabitFormModal open={showForm} onClose={()=>{setShowForm(false);setEditHabit(null)}} editing={editHabit} />
    </div>
  )
}

// ─── Layout helpers ───────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color:'var(--text3)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color:'var(--text)' }}>{value}</div>
    </div>
  )
}

function GridSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 min-w-0" style={{ alignItems:'flex-start' }}>
      {children}
    </div>
  )
}

function AnalysisSidebar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width:195, flexShrink:0, paddingTop:2 }}>
      <div className="text-sm font-semibold mb-3 text-right" style={{ color:'var(--text)' }}>Analysis</div>
      {children}
    </div>
  )
}

function AnalysisRow({ emoji, label, pct, color, sub }: { emoji:string; label:string; pct:number; color:string; sub?:string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ fontSize:12 }}>{emoji}</span>
        <span style={{ fontSize:11, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{label}</span>
        <span style={{ fontSize:10, color, flexShrink:0, marginLeft:4 }}>{pct}%</span>
      </div>
      <div className="overflow-hidden rounded-full" style={{ height:7, background:'var(--bg4)' }}>
        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:color }}/>
      </div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color:'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

// ─── Habit Grid ───────────────────────────────────────────────────────────────
function HabitGrid({ weeks, days, dayWeekMap, activeHabits, todayISO, isChecked, toggle, dayStats, onEdit, onDelete }: {
  weeks: { days: Date[]; weekNum: number; color: string }[]
  days: Date[]
  dayWeekMap: Record<string, { wi: number; color: string }>
  activeHabits: Habit[]
  todayISO: string
  isChecked: (hid: string, date: string) => boolean
  toggle: (hid: string, date: string) => void
  dayStats: { iso: string; done: number; notDone: number; pct: number }[]
  onEdit: (h: Habit) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <table style={{ borderCollapse:'collapse', tableLayout:'fixed', minWidth: 160 + 35*24 }}>
        <colgroup>
          <col style={{ width:160 }}/>
          {days.map((_,i)=><col key={i} style={{ width:24 }}/>)}
        </colgroup>
        <thead>
          <tr>
            <th/>
            {weeks.map(w=>(
              <th key={w.weekNum} colSpan={7} style={{ textAlign:'center', fontSize:11, fontWeight:700, padding:'5px 2px',
                background: w.color+'28', color:w.color, borderBottom:`2px solid ${w.color}` }}>
                Week {w.weekNum}
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ textAlign:'left', paddingLeft:8, fontSize:10, fontWeight:600, color:'var(--text3)', paddingBottom:2 }}>My Habits</th>
            {days.map((d,di)=>{
              const iso=isoFromDate(d); const wi=dayWeekMap[iso]
              return <th key={di} style={{ textAlign:'center', fontSize:9, fontWeight:500, color:'var(--text3)', background: wi?.color+'12', padding:'2px 0' }}>
                {DAY_ABBR[d.getDay()]}
              </th>
            })}
          </tr>
          <tr>
            <th/>
            {days.map((d,di)=>{
              const iso=isoFromDate(d); const wi=dayWeekMap[iso]; const isT=iso===todayISO
              return <th key={di} style={{ textAlign:'center', fontSize:9, fontWeight:isT?800:400, color:isT?(wi?.color||'var(--text)'):'var(--text3)', background:wi?.color+'12', paddingBottom:4 }}>
                {d.getDate()}
              </th>
            })}
          </tr>
        </thead>
        <tbody>
          {activeHabits.map(h=>(
            <tr key={h.id} className="group" style={{ borderBottom:'1px solid var(--border)' }}>
              <td style={{ padding:'3px 8px' }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize:13 }}>{h.emoji}</span>
                  <span style={{ fontSize:11, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:100 }}>{h.title}</span>
                  <div className="hidden group-hover:flex items-center gap-1 ml-auto flex-shrink-0">
                    <button onClick={()=>onEdit(h)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:10,padding:0 }}>✎</button>
                    <button onClick={()=>onDelete(h.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:10,padding:0 }}>✕</button>
                  </div>
                </div>
              </td>
              {days.map((d,di)=>{
                const iso=isoFromDate(d); const wi=dayWeekMap[iso]; const wc=wi?.color||'#7c5cfc'
                const checked=isChecked(h.id,iso); const future=iso>todayISO
                return (
                  <td key={di} style={{ textAlign:'center', padding:'2px 1px', background:wc+'08' }}>
                    <button onClick={()=>!future&&toggle(h.id,iso)} style={{
                      width:18, height:18, borderRadius:3, border:`1px solid ${checked?wc:'var(--border2)'}`,
                      background:checked?wc:'transparent', cursor:future?'default':'pointer',
                      opacity:future?0.25:1, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
                    }}>
                      {checked&&<span style={{ color:'#fff', fontSize:9, lineHeight:1, fontWeight:700 }}>✓</span>}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
          {/* Footer rows */}
          {[
            { label:'Progress', getValue:(ds: typeof dayStats[0])=>`${ds.pct}%`, color:'var(--text3)' },
            { label:'Done',     getValue:(ds: typeof dayStats[0])=>String(ds.done),    color:'#2dd4a0' },
            { label:'Not Done', getValue:(ds: typeof dayStats[0])=>String(ds.notDone), color:'#f05252' },
          ].map((row,ri)=>(
            <tr key={ri} style={{ borderTop: ri===0 ? '2px solid var(--border2)' : 'none' }}>
              <td style={{ fontSize:9, color:'var(--text3)', padding:`${ri===0?'3px':'1px'} 8px`, fontWeight:ri===0?700:400 }}>{row.label}</td>
              {dayStats.map((ds,di)=>{
                const wi=dayWeekMap[ds.iso]
                return <td key={di} style={{ textAlign:'center', fontSize:8, color:row.color, padding:'1px 0', background:wi?.color+'08' }}>
                  {row.getValue(ds)}
                </td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Mental State Grid ────────────────────────────────────────────────────────
function MentalStateGrid({ weeks, days, dayWeekMap, todayISO, moodMap, scoreData, setMoodEntry }: {
  weeks: { days: Date[]; weekNum: number; color: string }[]
  days: Date[]
  dayWeekMap: Record<string, { wi: number; color: string }>
  todayISO: string
  moodMap: Record<string, { mood: number; motivation: number }>
  scoreData: number[]
  setMoodEntry: (date: string, mood: number, motivation: number) => void
}) {
  return (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <table style={{ borderCollapse:'collapse', tableLayout:'fixed', minWidth: 160 + 35*24 }}>
        <colgroup>
          <col style={{ width:160 }}/>
          {days.map((_,i)=><col key={i} style={{ width:24 }}/>)}
        </colgroup>
        <thead>
          <tr>
            <th/>
            {weeks.map(w=>(
              <th key={w.weekNum} colSpan={7} style={{ textAlign:'center', fontSize:11, fontWeight:700, padding:'5px 2px',
                background:w.color+'28', color:w.color, borderBottom:`2px solid ${w.color}` }}>
                Week {w.weekNum}
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ textAlign:'left', paddingLeft:8, fontSize:10, fontWeight:600, color:'var(--text3)', paddingBottom:2 }}>Mental State</th>
            {days.map((d,di)=>{
              const iso=isoFromDate(d); const wi=dayWeekMap[iso]
              return <th key={di} style={{ textAlign:'center', fontSize:9, color:'var(--text3)', background:wi?.color+'12', padding:'2px 0' }}>
                {DAY_ABBR[d.getDay()]}
              </th>
            })}
          </tr>
          <tr>
            <th/>
            {days.map((d,di)=>{
              const iso=isoFromDate(d); const wi=dayWeekMap[iso]; const isT=iso===todayISO
              return <th key={di} style={{ textAlign:'center', fontSize:9, fontWeight:isT?800:400, color:isT?(wi?.color||'var(--text)'):'var(--text3)', background:wi?.color+'12', paddingBottom:4 }}>
                {d.getDate()}
              </th>
            })}
          </tr>
        </thead>
        <tbody>
          {/* Mood row */}
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            <td style={{ padding:'3px 8px', fontSize:11, color:'var(--text)' }}>
              <span style={{ fontSize:13 }}>😊</span> Mood
            </td>
            {days.map((d,di)=>{
              const iso=isoFromDate(d); const wi=dayWeekMap[iso]; const wc=wi?.color||'#7c5cfc'
              const entry=moodMap[iso]; const future=iso>todayISO
              return (
                <td key={di} style={{ textAlign:'center', padding:'2px 1px', background:wc+'08' }}>
                  <MoodPicker
                    value={entry?.mood ?? null}
                    isFuture={future}
                    weekColor={wc}
                    onPick={v=>setMoodEntry(iso, v, entry?.motivation ?? 5)}
                  />
                </td>
              )
            })}
          </tr>

          {/* Motivation row */}
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            <td style={{ padding:'3px 8px', fontSize:11, color:'var(--text)' }}>
              <span style={{ fontSize:13 }}>⚡</span> Motivation
            </td>
            {days.map((d,di)=>{
              const iso=isoFromDate(d); const wi=dayWeekMap[iso]; const wc=wi?.color||'#7c5cfc'
              const entry=moodMap[iso]; const future=iso>todayISO
              return (
                <td key={di} style={{ textAlign:'center', padding:'2px 1px', background:wc+'08' }}>
                  <MoodPicker
                    value={entry?.motivation ?? null}
                    isFuture={future}
                    weekColor={wc}
                    onPick={v=>setMoodEntry(iso, entry?.mood ?? 5, v)}
                  />
                </td>
              )
            })}
          </tr>

          {/* Score row */}
          <tr style={{ borderTop:'2px solid var(--border2)' }}>
            <td style={{ padding:'3px 8px', fontSize:9, color:'var(--text3)', fontWeight:700 }}>Score</td>
            {days.map((d,di)=>{
              const iso=isoFromDate(d); const wi=dayWeekMap[iso]; const s=scoreData[di]
              return <td key={di} style={{ textAlign:'center', fontSize:8, color: s>=70?'#2dd4a0':s>=40?'#f5a623':'var(--text3)', padding:'2px 0', background:wi?.color+'08' }}>
                {s>0 ? `${s}%` : ''}
              </td>
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
