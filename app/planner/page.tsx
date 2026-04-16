'use client'

import { useState, useMemo } from 'react'
import { useStore, useActiveSemester } from '@/lib/store'
import { currentWeekNumber, weekDateRange, isoFromDate, fmtDate, daysUntil } from '@/lib/weeks'
import { buildPriorityList } from '@/lib/priority'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Field, SectionHeading, CountdownChip } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import type { Priority } from '@/types'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const PRIORITY_COLOURS: Record<Priority, string> = { high:'var(--red)', medium:'var(--accent)', low:'var(--text3)' }

export default function PlannerPage() {
  const semester = useActiveSemester()
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const plannerTasks = useStore(s => s.plannerTasks)
  const weeklyLogs = useStore(s => s.weeklyLogs)
  const { addPlannerTask, updatePlannerTask, deletePlannerTask } = useStore()
  const curWeek = currentWeekNumber(semester)

  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [defaultDate, setDefaultDate] = useState('')

  const { days, monday, sunday } = weekDateRange(weekOffset)
  const weekLabel = `Week ${Math.max(1,curWeek+weekOffset)} — ${monday.toLocaleDateString('en-AU',{day:'numeric',month:'short'})} – ${sunday.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`

  function openTaskModal(dateStr = '') {
    setDefaultDate(dateStr)
    setShowForm(true)
  }

  function generatePlan() {
    const priorities = buildPriorityList(assessments, units, weeklyLogs, curWeek)
    const todayISO = isoFromDate(new Date())
    const todayIdx = days.findIndex(d => isoFromDate(d) === todayISO)
    const startIdx = todayIdx >= 0 ? todayIdx : 0

    let added = 0
    let nextSlot = startIdx

    priorities.slice(0,8).forEach((p, i) => {
      // Urgent = due today or overdue → always put on today
      const targetIdx = p.urgency === 'urgent' ? startIdx : nextSlot
      if (p.urgency !== 'urgent') {
        nextSlot = nextSlot + 1 < 7 ? nextSlot + 1 : startIdx
      }
      const ds = isoFromDate(days[targetIdx])
      const already = plannerTasks.some(t => t.date===ds && t.name===p.name && t.aiGenerated)
      if (!already) {
        addPlannerTask({ name: p.name, date: ds, unitId: null, priority: i<3?'high':'medium', estimatedHours: 2, done: false, aiGenerated: true })
        added++
      }
    })
    if (added === 0) toast('Plan already up to date','info')
    else toast(`Generated ${added} tasks for this week ✓`,'success')
  }

  // Upcoming deadlines for sidebar
  const upcoming = assessments
    .filter(a => { const d=daysUntil(a.dueDate); return d!==null&&d>=0&&d<=21&&!['submitted','graded','complete'].includes(a.status) })
    .sort((a,b) => daysUntil(a.dueDate)!-daysUntil(b.dueDate)!)
    .slice(0,8)

  // This week's assessment deadlines
  const mondayISO = isoFromDate(monday)
  const sundayISO = isoFromDate(sunday)
  const weekDeadlines = assessments.filter(a => a.dueDate && a.dueDate >= mondayISO && a.dueDate <= sundayISO)

  return (
    <div className="p-8 max-w-screen-xl">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-serif text-4xl font-light" style={{ color:'var(--text)' }}>Planner</h1>
          <p className="text-sm mt-1" style={{ color:'var(--text3)' }}>Weekly study plan, deadlines, and personal milestones</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={generatePlan}>⚡ Generate plan</button>
          <button className="btn btn-primary" onClick={()=>openTaskModal()}>+ Add task</button>
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>w-1)}>← Prev</button>
        <span className="text-sm font-medium min-w-64 text-center" style={{ color:'var(--text)' }}>{weekLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>w+1)}>Next →</button>
        {weekOffset !== 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(0)}>Today</button>}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns:'1fr 300px' }}>
        {/* Week grid */}
        <div className="grid gap-2" style={{ gridTemplateColumns:'repeat(7,1fr)' }}>
          {days.map((day, idx) => {
            const ds = isoFromDate(day)
            const isToday = ds === isoFromDate(new Date())
            const dayTasks = plannerTasks.filter(t => t.date===ds)
            const dayDeadlines = assessments.filter(a => a.dueDate===ds && !['submitted','graded','complete'].includes(a.status))
            return (
              <div key={ds} className="rounded-xl p-3 min-h-40" style={{ background:'var(--bg3)', border:`1px solid ${isToday?'rgba(124,92,252,0.4)':'var(--border)'}` }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:isToday?'var(--accent)':'var(--text3)' }}>
                  {DAYS[idx]} {day.getDate()}
                </div>
                {/* Deadlines */}
                {dayDeadlines.map(a => {
                  const unit = units.find(u=>u.id===a.unitId)
                  return (
                    <div key={a.id} className="flex items-start gap-1.5 p-1.5 rounded-lg mb-1 text-xs" style={{ background:'var(--red-dim)', border:'1px solid rgba(240,82,82,0.2)' }}>
                      <div className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background:'var(--red)' }} />
                      <span style={{ color:'var(--text)' }}>{a.name}{unit?` (${unit.code})`:''}</span>
                    </div>
                  )
                })}
                {/* Tasks */}
                {dayTasks.map(t => (
                  <div key={t.id} className="flex items-start gap-1.5 p-1.5 rounded-lg mb-1 text-xs cursor-pointer" style={{ background:'var(--bg4)', opacity:t.done?0.5:1 }}
                    onClick={()=>updatePlannerTask(t.id,{done:!t.done})}>
                    <div className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background: PRIORITY_COLOURS[t.priority] }} />
                    <span className="flex-1" style={{ color:'var(--text)', textDecoration:t.done?'line-through':'' }}>{t.name}</span>
                    <button onClick={e=>{e.stopPropagation();deletePlannerTask(t.id)}} style={{ background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:10,padding:0 }}>✕</button>
                  </div>
                ))}
                <button onClick={()=>openTaskModal(ds)} className="w-full mt-1 text-xs py-1 rounded-lg transition-colors"
                  style={{ background:'transparent',border:'1px dashed var(--border2)',color:'var(--text3)',cursor:'pointer' }}>+</button>
              </div>
            )
          })}
        </div>

        {/* Sidebar */}
        <div>
          <div className="card mb-4">
            <SectionHeading>This week's deadlines</SectionHeading>
            {weekDeadlines.length === 0
              ? <p className="text-xs" style={{ color:'var(--text3)' }}>No assessments due this week.</p>
              : weekDeadlines.map(a => {
                const unit = units.find(u=>u.id===a.unitId)
                return (
                  <div key={a.id} className="py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                    <div className="text-sm font-medium" style={{ color:'var(--text)' }}>{a.name}</div>
                    <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{unit?.code} · {fmtDate(a.dueDate)}</div>
                  </div>
                )
              })
            }
          </div>

          <div className="card">
            <SectionHeading>Upcoming (21 days)</SectionHeading>
            {upcoming.length === 0
              ? <p className="text-xs" style={{ color:'var(--text3)' }}>Nothing coming up.</p>
              : upcoming.map(a => {
                const days = daysUntil(a.dueDate)
                const unit = units.find(u=>u.id===a.unitId)
                const col = days!<=2?'var(--red)':days!<=7?'var(--amber)':'var(--text3)'
                return (
                  <div key={a.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                    <div className="font-mono text-xs min-w-8" style={{ color:col }}>{days}d</div>
                    <div className="flex-1">
                      <div className="text-xs font-medium" style={{ color:'var(--text)' }}>{a.name}</div>
                      <div className="text-[10px]" style={{ color:'var(--text3)' }}>{unit?.code}</div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>

      <AddTaskModal open={showForm} onClose={()=>setShowForm(false)} defaultDate={defaultDate} />
    </div>
  )
}

function AddTaskModal({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string }) {
  const units = useStore(s => s.units)
  const addPlannerTask = useStore(s => s.addPlannerTask)
  const [name, setName] = useState('')
  const [date, setDate] = useState(defaultDate || isoFromDate(new Date()))
  const [unitId, setUnitId] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [hours, setHours] = useState('1')

  useMemo(() => { setDate(defaultDate || isoFromDate(new Date())) }, [defaultDate])

  function save() {
    if (!name.trim()) { toast('Task name required','error'); return }
    addPlannerTask({ name: name.trim(), date, unitId: unitId||null, priority, estimatedHours: parseFloat(hours)||1, done: false, aiGenerated: false })
    toast('Task added','success')
    setName(''); setUnitId(''); setPriority('medium'); setHours('1')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add task" size="sm">
      <Field label="Task name"><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Start Assignment 2 draft" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} /></Field>
        <Field label="Unit (optional)">
          <select className="input" value={unitId} onChange={e=>setUnitId(e.target.value)}>
            <option value="">General</option>
            {units.map(u=><option key={u.id} value={u.id}>{u.code}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select className="input" value={priority} onChange={e=>setPriority(e.target.value as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Est. hours"><input type="number" className="input" value={hours} onChange={e=>setHours(e.target.value)} min={0.5} step={0.5} /></Field>
      </div>
      <ModalFooter>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Add task</button>
      </ModalFooter>
    </Modal>
  )
}
