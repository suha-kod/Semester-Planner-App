'use client'
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip
} from 'chart.js'

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)


import { useState, useEffect, useRef } from 'react'
import { useStore, useActiveSemester } from '@/lib/store'
import { currentWeekNumber, daysUntil, isoFromDate } from '@/lib/weeks'
import { computeUnitRisk, computeCurrentMark, computeProjectedMark, neededMarkForTarget } from '@/lib/risk'
import { buildPriorityList, generateRecommendations } from '@/lib/priority'
import { StatCard, RiskBadge, ProgressBar, SectionHeading, EmptyState } from '@/components/ui/index'
import type { PriorityItem } from '@/types'

const TABS = ['overview','priorities','hours','grades','risk'] as const
type Tab = typeof TABS[number]

export default function InsightsPage() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="p-8 max-w-screen-xl">
      <div className="mb-7">
        <h1 className="font-serif text-4xl font-light" style={{ color:'var(--text)' }}>Study Insights</h1>
        <p className="text-sm mt-1" style={{ color:'var(--text3)' }}>Analytics, trends, and grade projections</p>
      </div>

      <div className="flex gap-1 mb-6" style={{ borderBottom:'1px solid var(--border)' }}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className="px-4 py-2.5 text-sm font-medium capitalize"
            style={{ color:tab===t?'var(--accent)':'var(--text3)', background:'none', borderTop:'none', borderLeft:'none', borderRight:'none', borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`, cursor:'pointer' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview'    && <OverviewTab />}
      {tab === 'priorities'  && <PrioritiesTab />}
      {tab === 'hours'       && <HoursTab />}
      {tab === 'grades'      && <GradesTab />}
      {tab === 'risk'        && <RiskTab />}
    </div>
  )
}

// ── Alert banner ─────────────────────────────────────────────────────────────
function AlertBanner({ level, text }: { level: 'critical'|'urgent'|'soon'|'ok'; text: string }) {
  const s = {
    critical: { bg:'rgba(240,82,82,0.12)',  border:'rgba(240,82,82,0.25)',  color:'var(--red)',   icon:'🔴' },
    urgent:   { bg:'rgba(245,166,35,0.12)', border:'rgba(245,166,35,0.25)', color:'var(--amber)', icon:'🟠' },
    soon:     { bg:'rgba(96,165,250,0.12)', border:'rgba(96,165,250,0.25)', color:'var(--text2)', icon:'📅' },
    ok:       { bg:'rgba(45,212,160,0.10)', border:'rgba(45,212,160,0.20)', color:'var(--green)', icon:'✅' },
  }[level]
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl text-sm" style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>
      <span className="flex-shrink-0">{s.icon}</span>
      <span style={{ lineHeight:1.5 }}>{text}</span>
    </div>
  )
}

// ── Priority row ──────────────────────────────────────────────────────────────
function PriorityRow({ item, rank }: { item: PriorityItem; rank: number }) {
  const uc = item.urgency === 'urgent' ? 'var(--red)' : item.urgency === 'soon' ? 'var(--amber)' : 'var(--text3)'
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: rank<=3?'var(--accent-glow)':'var(--bg4)', color: rank<=3?'var(--accent)':'var(--text3)' }}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color:'var(--text)' }}>{item.name}</div>
        <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{item.meta}</div>
      </div>
      {item.urgency && (
        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
          style={{ background:uc+'18', color:uc, border:`1px solid ${uc}33` }}>
          {item.urgency}
        </span>
      )}
    </div>
  )
}

// ── Priorities Tab ────────────────────────────────────────────────────────────
function PrioritiesTab() {
  const units      = useStore(s => s.units)
  const assessments= useStore(s => s.assessments)
  const weeklyLogs = useStore(s => s.weeklyLogs)
  const semester   = useActiveSemester()
  const curWeek    = currentWeekNumber(semester)

  const priorities = buildPriorityList(assessments, units, weeklyLogs, curWeek)
  const recs       = generateRecommendations(units, assessments, weeklyLogs, curWeek)

  const overdue = assessments.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d < 0 && !['submitted','graded','complete'].includes(a.status)
  })
  const urgent = assessments.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d >= 0 && d <= 3 && !['submitted','graded','complete'].includes(a.status)
  }).sort((a,b) => daysUntil(a.dueDate)! - daysUntil(b.dueDate)!)
  const dueSoon = assessments.filter(a => {
    const d = daysUntil(a.dueDate)
    return d !== null && d > 3 && d <= 7 && !['submitted','graded','complete'].includes(a.status)
  })
  const atRisk = units
    .map(u => ({ u, r: computeUnitRisk(u, assessments.filter(a=>a.unitId===u.id), weeklyLogs, curWeek) }))
    .filter(x => x.r.level === 'high' || x.r.level === 'critical')

  const allClear = overdue.length===0 && urgent.length===0 && atRisk.length===0

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns:'1fr 340px' }}>
      {/* Left: priority list */}
      <div>
        <SectionHeading>What to focus on now</SectionHeading>
        {priorities.length === 0
          ? <p className="text-sm mb-6" style={{ color:'var(--text3)' }}>Nothing urgent right now. Stay on top of weekly tasks.</p>
          : <div className="space-y-2 mb-6">
              {priorities.map((p,i) => <PriorityRow key={i} item={p} rank={i+1} />)}
            </div>
        }

        <SectionHeading>Suggestions</SectionHeading>
        <div className="space-y-2">
          {recs.map((r,i) => (
            <div key={i} className="p-3.5 rounded-xl text-sm" style={{ background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)', lineHeight:1.6 }}>
              {r}
            </div>
          ))}
        </div>
      </div>

      {/* Right: alerts + upcoming */}
      <div>
        <SectionHeading>Smart alerts</SectionHeading>
        <div className="space-y-2 mb-6">
          {allClear && <AlertBanner level="ok" text="All clear! No overdue items, urgent deadlines, or high-risk units." />}
          {overdue.map(a => {
            const unit = units.find(u=>u.id===a.unitId)
            const d = Math.abs(daysUntil(a.dueDate)!)
            return <AlertBanner key={a.id} level="critical" text={`"${a.name}"${unit?` (${unit.code})`:''} is overdue by ${d} day${d!==1?'s':''}. Submit or speak to your lecturer.`} />
          })}
          {urgent.map(a => {
            const unit = units.find(u=>u.id===a.unitId)
            const d = daysUntil(a.dueDate)!
            return <AlertBanner key={a.id} level="urgent" text={`"${a.name}"${unit?` (${unit.code})`:''} is due ${d===0?'TODAY':`in ${d} day${d!==1?'s':''}`}. Top priority.`} />
          })}
          {dueSoon.map(a => {
            const unit = units.find(u=>u.id===a.unitId)
            const d = daysUntil(a.dueDate)!
            return <AlertBanner key={a.id} level="soon" text={`"${a.name}"${unit?` (${unit.code})`:''} due in ${d} days.`} />
          })}
          {atRisk.map(({u,r}) => (
            <AlertBanner key={u.id} level="urgent" text={`${u.code} is ${r.level} risk — ${r.reasons[0]||'needs attention'}.`} />
          ))}
        </div>

        <SectionHeading>Upcoming deadlines</SectionHeading>
        {assessments
          .filter(a => { const d=daysUntil(a.dueDate); return d!==null&&d>=0&&d<=21&&!['submitted','graded','complete'].includes(a.status) })
          .sort((a,b) => daysUntil(a.dueDate)!-daysUntil(b.dueDate)!)
          .slice(0,8)
          .map(a => {
            const unit = units.find(u=>u.id===a.unitId)
            const d = daysUntil(a.dueDate)!
            const col = d<=2?'var(--red)':d<=7?'var(--amber)':'var(--text3)'
            return (
              <div key={a.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom:'1px solid var(--border)' }}>
                <div className="font-mono text-sm font-bold min-w-8" style={{ color:col }}>{d}d</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color:'var(--text)' }}>{a.name}</div>
                  <div className="text-xs" style={{ color:'var(--text3)' }}>{unit?.code} · {a.weight}% weight</div>
                </div>
              </div>
            )
          })
        }
        {assessments.filter(a=>{const d=daysUntil(a.dueDate);return d!==null&&d>=0&&d<=21&&!['submitted','graded','complete'].includes(a.status)}).length===0 && (
          <p className="text-sm" style={{ color:'var(--text3)' }}>Nothing due in the next 21 days.</p>
        )}
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const studyHours = useStore(s => s.studyHours)
  const weeklyLogs = useStore(s => s.weeklyLogs)
  const semester = useActiveSemester()
  const curWeek = currentWeekNumber(semester)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<any>(null)

  const totalHours = studyHours.reduce((s,h)=>s+h.hours,0)
  const graded = assessments.filter(a=>a.mark!==null&&a.mark!==undefined)
  const avgMark = graded.length>0 ? graded.reduce((s,a)=>s+(a.mark!/(a.maxMark||100)*100),0)/graded.length : null

  useEffect(() => {
    if (!chartRef.current) return
    let cancelled = false
    chartInstance.current?.destroy()
    chartInstance.current = null
    import('chart.js').then(({ Chart }) => {
      if (cancelled || !chartRef.current) return
      const last4 = Array.from({length:4},(_,i)=>{
        const ws = new Date(); ws.setDate(ws.getDate()-ws.getDay()+1-(3-i)*7)
        const we = new Date(ws); we.setDate(ws.getDate()+6)
        const hrs = studyHours.filter(h=>{const d=new Date(h.date+'T00:00:00');return d>=ws&&d<=we}).reduce((s,h)=>s+h.hours,0)
        return { label:`W-${3-i}`, hrs }
      })
      chartInstance.current = new Chart(chartRef.current, {
        type:'bar',
        data:{ labels:last4.map(d=>d.label), datasets:[{ data:last4.map(d=>d.hrs), backgroundColor:'rgba(59,130,246,0.5)', borderColor:'#3b82f6', borderWidth:1, borderRadius:4 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},border:{display:false},ticks:{color:'#9d9ba8',font:{size:10}}}, y:{grid:{display:false},border:{display:false},ticks:{color:'#9d9ba8',font:{size:10}},beginAtZero:true} } }
      })
    })
    return () => { cancelled = true; chartInstance.current?.destroy(); chartInstance.current = null }
  }, [studyHours])

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total study hours" value={totalHours.toFixed(1)} colour="teal" sub="logged this semester" />
        <StatCard label="Assessments done" value={`${graded.length}/${assessments.length}`} colour="accent" sub="graded / total" />
        <StatCard label="Avg mark" value={avgMark!==null?`${avgMark.toFixed(1)}%`:'—'} colour={avgMark!==null?(avgMark>=70?'green':avgMark>=50?'amber':'red'):'default'} sub="across graded work" />
        <StatCard label="Current week" value={`${curWeek}/${semester?.totalWeeks??13}`} sub="semester progress" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <SectionHeading>Unit marks summary</SectionHeading>
          {units.length===0
            ? <p className="text-sm" style={{color:'var(--text3)'}}>No units added.</p>
            : units.map(u=>{
              const m = computeCurrentMark(assessments.filter(a=>a.unitId===u.id))
              const pct = m??0
              const col = m!==null?(m>=70?'green':m>=50?'amber':'red'):'accent'
              return (
                <div key={u.id} className="mb-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{color:'var(--text2)'}}>{u.code}</span>
                    <span className="font-mono" style={{color:`var(--${col})`}}>{m!==null?m.toFixed(1)+'%':'—'}{u.targetMark?` / ${u.targetMark}%`:''}</span>
                  </div>
                  <ProgressBar value={m!==null?Math.min(100,pct):0} colour={col as any} />
                </div>
              )
            })
          }
        </div>

        <div className="card">
          <SectionHeading>Semester progress</SectionHeading>
          <ProgressBar value={Math.round(curWeek/(semester?.totalWeeks??13)*100)} colour="accent" height={10} />
          <p className="text-xs mt-2 mb-5" style={{color:'var(--text3)'}}>Week {curWeek} of {semester?.totalWeeks??13} ({Math.round(curWeek/(semester?.totalWeeks??13)*100)}% through semester)</p>
          <SectionHeading>Study hours — last 4 weeks</SectionHeading>
          <div style={{height:100,position:'relative'}}><canvas ref={chartRef} /></div>
        </div>
      </div>
    </div>
  )
}

function HoursTab() {
  const studyHours = useStore(s => s.studyHours)
  const units = useStore(s => s.units)
  const deleteStudyHours = useStore(s => s.deleteStudyHours)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<any>(null)

  useEffect(() => {
    if (!chartRef.current) return
    let cancelled = false
    chartInstance.current?.destroy()
    chartInstance.current = null
    import('chart.js').then(({ Chart }) => {
      if (cancelled || !chartRef.current) return
      const last30 = Array.from({length:30},(_,i)=>{
        const d = new Date(); d.setDate(d.getDate()-29+i)
        const ds = isoFromDate(d)
        return { label:i%5===0?d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}):'', hrs:studyHours.filter(h=>h.date===ds).reduce((s,h)=>s+h.hours,0) }
      })
      chartInstance.current = new Chart(chartRef.current, {
        type:'bar',
        data:{ labels:last30.map(d=>d.label), datasets:[{ data:last30.map(d=>d.hrs), backgroundColor:'rgba(45,212,160,0.45)', borderColor:'#2dd4a0', borderWidth:1, borderRadius:3 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},border:{display:false},ticks:{color:'#9d9ba8',font:{size:10}}}, y:{grid:{display:false},border:{display:false},ticks:{color:'#9d9ba8',font:{size:10}},beginAtZero:true} } }
      })
    })
    return () => { cancelled = true; chartInstance.current?.destroy(); chartInstance.current = null }
  }, [studyHours])

  const byUnit = units.map(u=>({ unit:u, hours:studyHours.filter(h=>h.unitId===u.id).reduce((s,h)=>s+h.hours,0) })).filter(x=>x.hours>0).sort((a,b)=>b.hours-a.hours)
  const general = studyHours.filter(h=>!h.unitId).reduce((s,h)=>s+h.hours,0)
  const recent = [...studyHours].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,10)

  return (
    <div>
      <div className="card mb-5">
        <SectionHeading>Daily study hours — last 30 days</SectionHeading>
        <div style={{height:180,position:'relative'}}><canvas ref={chartRef} /></div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <SectionHeading>By unit</SectionHeading>
          {byUnit.length===0&&general===0 ? <p className="text-sm" style={{color:'var(--text3)'}}>No hours logged yet.</p>
            : <>
              {byUnit.map(x=>(
                <div key={x.unit.id} className="flex justify-between py-2 text-sm" style={{borderBottom:'1px solid var(--border)'}}>
                  <span style={{color:'var(--text)'}}>{x.unit.code}</span>
                  <span className="font-mono" style={{color:'var(--teal)'}}>{x.hours.toFixed(1)}h</span>
                </div>
              ))}
              {general>0&&<div className="flex justify-between py-2 text-sm"><span style={{color:'var(--text3)'}}>General</span><span className="font-mono" style={{color:'var(--text2)'}}>{general.toFixed(1)}h</span></div>}
            </>
          }
        </div>
        <div className="card">
          <SectionHeading>Recent log</SectionHeading>
          {recent.length===0 ? <p className="text-sm" style={{color:'var(--text3)'}}>No hours logged yet.</p>
            : recent.map(h=>{
              const unit = units.find(u=>u.id===h.unitId)
              return (
                <div key={h.id} className="flex items-center gap-3 py-2" style={{borderBottom:'1px solid var(--border)'}}>
                  <div className="flex-1">
                    <div className="text-xs font-medium" style={{color:'var(--text)'}}>{new Date(h.date+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'})}</div>
                    <div className="text-xs" style={{color:'var(--text3)'}}>{unit?.code??'General'}{h.notes?` · ${h.notes}`:''}</div>
                  </div>
                  <span className="font-mono text-sm" style={{color:'var(--teal)'}}>{h.hours.toFixed(1)}h</span>
                  <button onClick={()=>deleteStudyHours(h.id)} className="btn btn-ghost btn-icon btn-sm text-xs" style={{opacity:0.6}}>✕</button>
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}

function GradesTab() {
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)

  if (units.length===0) return <EmptyState icon="📊" title="No units yet" description="Add units to see grade analysis" />

  return (
    <div className="grid grid-cols-2 gap-5">
      {units.map(u=>{
        const uAssess = assessments.filter(a=>a.unitId===u.id)
        const mark = computeCurrentMark(uAssess)
        const projected = computeProjectedMark(uAssess)
        const needed = neededMarkForTarget(u, uAssess)
        const gradedW = uAssess.filter(a=>a.mark!==null&&a.mark!==undefined).reduce((s,a)=>s+(a.weight||0),0)
        const totalW = uAssess.reduce((s,a)=>s+(a.weight||0),0)

        return (
          <div key={u.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-xs font-mono" style={{color:'var(--text3)',textTransform:'uppercase',letterSpacing:'1px'}}>{u.code}</div>
                <div className="text-base font-medium mt-0.5" style={{color:'var(--text)'}}>{u.name}</div>
              </div>
              {mark!==null
                ? <span className="font-mono text-2xl font-semibold" style={{color:mark>=70?'var(--green)':mark>=50?'var(--amber)':'var(--red)'}}>{mark.toFixed(1)}%</span>
                : <span className="text-sm" style={{color:'var(--text3)'}}>No grades yet</span>
              }
            </div>

            {uAssess.map(a=>{
              const hasMark = a.mark!==null&&a.mark!==undefined
              const pct = hasMark?Math.round(a.mark!/(a.maxMark||100)*100):null
              return (
                <div key={a.id} className="flex items-center gap-2 py-2 text-xs" style={{borderBottom:'1px solid var(--border)'}}>
                  <div className="flex-1">
                    <span className="font-medium" style={{color:'var(--text)'}}>{a.name}</span>
                    <span className="ml-2" style={{color:'var(--text3)'}}>{a.weight}%</span>
                  </div>
                  {hasMark
                    ? <span className="font-mono" style={{color:pct!>=70?'var(--green)':pct!>=50?'var(--amber)':'var(--red)'}}>{a.mark}/{a.maxMark}</span>
                    : <span className={`status-badge status-${a.status}`}>{a.status.replace('-',' ')}</span>
                  }
                </div>
              )
            })}

            {u.targetMark && needed!==null && (
              <div className="mt-3 p-3 rounded-lg text-xs" style={{background:'var(--accent-glow)',color:'var(--accent)'}}>
                Need <strong>{Math.max(0,needed).toFixed(1)}%</strong> on remaining {(totalW-gradedW).toFixed(0)}% weight to reach {u.targetMark}%
                {needed>100&&' ⚠ Not achievable at this pace'}
                {needed<0&&' ✓ Already achieved!'}
              </div>
            )}
            {projected!==null&&<p className="text-xs mt-2" style={{color:'var(--text3)'}}>Projected: {projected.toFixed(1)}% (65% on remaining)</p>}
          </div>
        )
      })}
    </div>
  )
}

function RiskTab() {
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const weeklyLogs = useStore(s => s.weeklyLogs)
  const semester = useActiveSemester()
  const curWeek = currentWeekNumber(semester)

  if (units.length===0) return <EmptyState icon="🛡" title="No units to analyse" />

  const sorted = units.map(u=>({ u, r:computeUnitRisk(u,assessments.filter(a=>a.unitId===u.id),weeklyLogs,curWeek) })).sort((a,b)=>b.r.score-a.r.score)

  return (
    <div>
      {sorted.map(({u,r})=>(
        <div key={u.id} className="card mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs font-mono" style={{color:'var(--text3)',textTransform:'uppercase',letterSpacing:'1px'}}>{u.code}</div>
              <div className="text-base font-medium mt-0.5" style={{color:'var(--text)'}}>{u.name}</div>
            </div>
            <div className="text-right">
              <RiskBadge level={r.level} />
              <div className="text-xs font-mono mt-1" style={{color:'var(--text3)'}}>score: {Math.round(r.score)}</div>
            </div>
          </div>
          {r.reasons.length>0
            ? <div className="flex flex-wrap gap-2">{r.reasons.map((reason,i)=><span key={i} className="text-xs px-2 py-1 rounded-lg" style={{background:'var(--amber-dim)',color:'var(--amber)',border:'1px solid rgba(245,166,35,0.2)'}}>⚠ {reason}</span>)}</div>
            : <p className="text-xs" style={{color:'var(--text3)'}}>✓ No risk factors detected</p>
          }
        </div>
      ))}
    </div>
  )
}
