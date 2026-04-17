'use client'

import { useState, useMemo } from 'react'
import { useStore, useActiveSemester } from '@/lib/store'
import { fmtDate, daysUntil, currentWeekNumber } from '@/lib/weeks'
import { StatusBadge, CountdownChip, EmptyState, ConfirmDialog } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import { PlusIcon, TrashIcon } from '@/components/layout/Icons'
import { computeUnitRisk, effectiveWeight, parseBestOf } from '@/lib/risk'
import { AssessmentFormModal } from '@/components/assessments/AssessmentFormModal'
import type { Assessment, AssessmentType, AssessmentStatus } from '@/types'

const TABS = ['all','upcoming','overdue'] as const
type Tab = typeof TABS[number]

const TYPES: AssessmentType[] = ['assignment','quiz','exam','midsem','lab','presentation','group','participation','hurdle','other']
const STATUSES: AssessmentStatus[] = ['not-started','planned','in-progress','submitted','graded','overdue','complete']

export default function AssessmentsPage() {
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const weeklyLogs = useStore(s => s.weeklyLogs)
  const semester = useActiveSemester()
  const curWeek = currentWeekNumber(semester)
  const [tab, setTab] = useState<Tab>('all')
  const [filterUnit, setFilterUnit] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Assessment | null>(null)

  const today = new Date(); today.setHours(0,0,0,0)

  const unitRiskScores = useMemo(() => {
    const map = new Map<string, number>()
    units.forEach(u => {
      const uAssess = assessments.filter(a => a.unitId === u.id)
      const uLogs = weeklyLogs.filter(l => l.unitId === u.id)
      map.set(u.id, computeUnitRisk(u, uAssess, uLogs, curWeek).score)
    })
    return map
  }, [units, assessments, weeklyLogs, curWeek])

  const filtered = useMemo(() => {
    const submitted = ['submitted','graded','complete']
    let list = [...assessments]
    if (filterUnit) list = list.filter(a => a.unitId === filterUnit)
    if (tab === 'upcoming') list = list.filter(a => { const d=daysUntil(a.dueDate); return d!==null&&d>=0&&!submitted.includes(a.status) })
    if (tab === 'overdue')  list = list.filter(a => { if(!a.dueDate)return false; return new Date(a.dueDate+'T00:00:00')<today&&!submitted.includes(a.status) })
    return list.sort((a,b) => {
      if (!a.dueDate&&!b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      const dayDiff = new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime()
      // If due on the same day, prioritise by unit risk score (higher = more urgent)
      if (dayDiff === 0) return (unitRiskScores.get(b.unitId)??0)-(unitRiskScores.get(a.unitId)??0)
      return dayDiff
    })
  }, [assessments, tab, filterUnit, today, unitRiskScores])

  return (
    <div className="p-8 max-w-screen-xl">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-serif text-4xl font-light" style={{ color:'var(--text)' }}>Assessments & Exams</h1>
          <p className="text-sm mt-1" style={{ color:'var(--text3)' }}>All tasks, deadlines, and grades across your units</p>
        </div>
        <div className="flex gap-2">
          <select className="input" style={{ width:200 }} value={filterUnit} onChange={e=>setFilterUnit(e.target.value)}>
            <option value="">All units</option>
            {units.map(u=><option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={()=>{ setEditing(null); setShowForm(true) }}>
            <PlusIcon className="w-4 h-4" /> Add assessment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom:'1px solid var(--border)' }}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className="px-4 py-2.5 text-sm font-medium capitalize transition-colors"
            style={{ color:tab===t?'var(--accent)':'var(--text3)', background:'none', borderTop:'none', borderLeft:'none', borderRight:'none', borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`, cursor:'pointer' }}>
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <EmptyState icon="📋" title={tab==='all'?'No assessments yet':'Nothing in this category'} description="Add assessments to track grades, deadlines and progress" action={<button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Add assessment</button>} />
        : (
          <div className="overflow-x-auto">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Assessment','Unit','Type','Weight','Due date','Mark','Status',''].map(h=>(
                    <th key={h} style={{ textAlign:'left', padding:'10px 14px', color:'var(--text3)', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.7px', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a=>{
                  const unit = units.find(u=>u.id===a.unitId)
                  const hasMark = a.mark!==null&&a.mark!==undefined
                  const markPct = hasMark?Math.round(a.mark!/( a.maxMark||100)*100):null
                  return (
                    <tr key={a.id} onClick={()=>{setEditing(a);setShowForm(true)}} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      <td style={{ padding:'12px 14px', color:'var(--text)', fontWeight:500 }}>
                        {a.name}
                        {a.specialRules&&<div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{a.specialRules}</div>}
                      </td>
                      <td style={{ padding:'12px 14px' }}><span className="chip chip-future text-xs">{unit?.code??'—'}</span></td>
                      <td style={{ padding:'12px 14px', color:'var(--text2)', textTransform:'capitalize' }}>{a.type}</td>
                      <td style={{ padding:'12px 14px', fontFamily:'var(--font-mono)', color:'var(--text)' }}>
                        {parseBestOf(a.specialRules)
                          ? <><span>{effectiveWeight(a).toFixed(2).replace(/\.?0+$/, '')}%</span><span style={{ fontSize:10, color:'var(--text3)', marginLeft:4 }}>({a.weight}% total)</span></>
                          : <>{a.weight}%</>}
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        {a.dueDate?<><div style={{ color:'var(--text)', fontSize:12 }}>{fmtDate(a.dueDate)}</div><CountdownChip dateStr={a.dueDate} status={a.status} /></>:<span style={{ color:'var(--text3)' }}>TBA</span>}
                      </td>
                      <td style={{ padding:'12px 14px', fontFamily:'var(--font-mono)' }}>
                        {hasMark?<span style={{ color:markPct!>=70?'var(--green)':markPct!>=50?'var(--amber)':'var(--red)' }}>{a.mark}/{a.maxMark} <span style={{ fontSize:11, color:'var(--text3)' }}>({markPct}%)</span></span>:<span style={{ color:'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ padding:'12px 14px' }}><StatusBadge status={a.status} /></td>
                      <td style={{ padding:'12px 14px' }} onClick={e=>e.stopPropagation()}>
                        <DeleteAssessmentBtn id={a.id} name={a.name} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      }

      <AssessmentFormModal open={showForm} onClose={()=>setShowForm(false)} editing={editing} defaultUnitId={filterUnit} />
    </div>
  )
}

function DeleteAssessmentBtn({ id, name }: { id: string; name: string }) {
  const deleteAssessment = useStore(s => s.deleteAssessment)
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>setConfirm(true)} title="Delete"><TrashIcon className="w-3.5 h-3.5" /></button>
      <ConfirmDialog open={confirm} onCancel={()=>setConfirm(false)} onConfirm={()=>{ deleteAssessment(id); setConfirm(false); toast('Deleted','info') }} title="Delete assessment" message={`Delete "${name}"?`} confirmLabel="Delete" danger />
    </>
  )
}

