'use client'

import { useState, useMemo } from 'react'
import { useStore, useActiveSemester } from '@/lib/store'
import { currentWeekNumber, weekDateRange, isoFromDate, fmtDate, daysUntil } from '@/lib/weeks'
import { buildPriorityList } from '@/lib/priority'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Field } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import type { Priority, PlannerTask } from '@/types'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const PRIORITY_COLOURS: Record<Priority, string> = { high:'var(--red)', medium:'var(--accent)', low:'var(--text3)' }
const PRIORITY_BG: Record<Priority, string> = { high:'rgba(240,82,82,0.12)', medium:'rgba(124,92,252,0.12)', low:'rgba(255,255,255,0.04)' }
const STATUS_COLOURS: Record<string, string> = {
  'not-started': 'var(--text3)',
  'in-progress':  'var(--amber)',
  'complete':     'var(--green)',
}

type GroupKey = 'overdue' | 'today' | 'week' | 'later' | 'done'
type ViewMode = 'list' | 'board'

function groupTask(t: PlannerTask, todayISO: string, sundayISO: string): GroupKey {
  if (t.done || t.status === 'complete') return 'done'
  if (t.date < todayISO) return 'overdue'
  if (t.date === todayISO) return 'today'
  if (t.date <= sundayISO) return 'week'
  return 'later'
}

export default function PlannerPage() {
  const semester = useActiveSemester()
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const plannerTasks = useStore(s => s.plannerTasks)
  const weeklyLogs = useStore(s => s.weeklyLogs)
  const { addPlannerTask, updatePlannerTask, deletePlannerTask } = useStore()
  const curWeek = currentWeekNumber(semester)

  const [view, setView] = useState<ViewMode>('list')
  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null)
  const [defaultDate, setDefaultDate] = useState('')

  // Filters
  const [filterUnit, setFilterUnit] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showDone, setShowDone] = useState(false)

  const todayISO = isoFromDate(new Date())
  const { days, monday, sunday } = weekDateRange(weekOffset)
  const sundayISO = isoFromDate(sunday)
  const weekLabel = `Week ${Math.max(1,curWeek+weekOffset)} — ${monday.toLocaleDateString('en-AU',{day:'numeric',month:'short'})} – ${sunday.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`

  function openAdd(dateStr = '') { setDefaultDate(dateStr); setEditingTask(null); setShowForm(true) }
  function openEdit(t: PlannerTask) { setEditingTask(t); setDefaultDate(t.date); setShowForm(true) }

  function generatePlan() {
    const priorities = buildPriorityList(assessments, units, weeklyLogs, curWeek)
    const todayIdx = days.findIndex(d => isoFromDate(d) === todayISO)
    const startIdx = todayIdx >= 0 ? todayIdx : 0
    let added = 0; let nextSlot = startIdx
    priorities.slice(0,8).forEach((p, i) => {
      const targetIdx = p.urgency === 'urgent' ? startIdx : nextSlot
      if (p.urgency !== 'urgent') nextSlot = nextSlot + 1 < 7 ? nextSlot + 1 : startIdx
      const ds = isoFromDate(days[targetIdx])
      const already = plannerTasks.some(t => t.date===ds && t.name===p.name && t.aiGenerated)
      if (!already) {
        addPlannerTask({ name: p.name, date: ds, unitId: null, assessmentId: null, priority: i<3?'high':'medium', estimatedHours: 2, done: false, status: 'not-started', notes: '', aiGenerated: true })
        added++
      }
    })
    if (added === 0) toast('Plan already up to date','info')
    else toast(`Generated ${added} tasks ✓`,'success')
  }

  // Filtered tasks
  const filtered = useMemo(() => plannerTasks.filter(t => {
    if (filterUnit && t.unitId !== filterUnit) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterStatus && (t.status ?? (t.done?'complete':'not-started')) !== filterStatus) return false
    return true
  }), [plannerTasks, filterUnit, filterPriority, filterStatus])

  // Grouped for list view
  const groups = useMemo(() => {
    const g: Record<GroupKey, PlannerTask[]> = { overdue:[], today:[], week:[], later:[], done:[] }
    filtered.forEach(t => { g[groupTask(t, todayISO, sundayISO)].push(t) })
    Object.values(g).forEach(arr => arr.sort((a,b) => {
      const po: Record<Priority,number> = { high:0, medium:1, low:2 }
      return po[a.priority] - po[b.priority] || a.date.localeCompare(b.date)
    }))
    return g
  }, [filtered, todayISO, sundayISO])

  const totalActive = groups.overdue.length + groups.today.length + groups.week.length + groups.later.length
  const doneToday = plannerTasks.filter(t => t.date === todayISO && (t.done || t.status === 'complete')).length
  const totalToday = plannerTasks.filter(t => t.date === todayISO).length

  // Upcoming deadlines sidebar
  const upcoming = assessments
    .filter(a => { const d=daysUntil(a.dueDate); return d!==null&&d>=0&&d<=21&&!['submitted','graded','complete'].includes(a.status) })
    .sort((a,b) => daysUntil(a.dueDate)!-daysUntil(b.dueDate)!)
    .slice(0,10)

  const GROUPS: { key: GroupKey; label: string; accent: string }[] = [
    { key:'overdue', label:'Overdue', accent:'var(--red)' },
    { key:'today',   label:'Today',   accent:'var(--accent)' },
    { key:'week',    label:'This week', accent:'var(--amber)' },
    { key:'later',   label:'Later',   accent:'var(--text3)' },
    ...(showDone ? [{ key:'done' as GroupKey, label:'Completed', accent:'var(--green)' }] : []),
  ]

  return (
    <div className="p-8 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl font-light" style={{ color:'var(--text)' }}>Task Tracker</h1>
          <p className="text-sm mt-1" style={{ color:'var(--text3)' }}>
            {totalActive} active · {doneToday}/{totalToday} done today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border:'1px solid var(--border2)' }}>
            {(['list','board'] as ViewMode[]).map(v => (
              <button key={v} onClick={()=>setView(v)}
                className="px-3 py-1.5 text-sm capitalize transition-colors"
                style={{ background: view===v ? 'var(--accent)' : 'var(--bg3)', color: view===v ? '#fff' : 'var(--text3)' }}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={generatePlan}>⚡ Generate plan</button>
          <button className="btn btn-primary" onClick={()=>openAdd()}>+ Add task</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select className="input" style={{ width:'auto', minWidth:120, fontSize:13, padding:'6px 10px' }}
          value={filterUnit} onChange={e=>setFilterUnit(e.target.value)}>
          <option value="">All units</option>
          {units.map(u=><option key={u.id} value={u.id}>{u.code}</option>)}
        </select>
        <select className="input" style={{ width:'auto', minWidth:120, fontSize:13, padding:'6px 10px' }}
          value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="input" style={{ width:'auto', minWidth:130, fontSize:13, padding:'6px 10px' }}
          value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="not-started">Not started</option>
          <option value="in-progress">In progress</option>
          <option value="complete">Complete</option>
        </select>
        {(filterUnit||filterPriority||filterStatus) && (
          <button onClick={()=>{setFilterUnit('');setFilterPriority('');setFilterStatus('')}}
            className="text-xs px-2 py-1 rounded" style={{ background:'var(--bg4)', color:'var(--text3)', border:'none', cursor:'pointer' }}>
            Clear
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color:'var(--text3)' }}>
            <input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)} />
            Show completed
          </label>
        </div>
      </div>

      {view === 'list' ? (
        <div className="grid gap-5" style={{ gridTemplateColumns:'1fr 280px' }}>
          {/* Task groups */}
          <div className="space-y-6">
            {GROUPS.map(({ key, label, accent }) => {
              const tasks = groups[key]
              if (tasks.length === 0 && key !== 'today') return null
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                    <span className="text-sm font-semibold" style={{ color: accent }}>{label}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background:'var(--bg4)', color:'var(--text3)' }}>{tasks.length}</span>
                  </div>
                  {tasks.length === 0 ? (
                    <div className="rounded-xl p-4 text-sm" style={{ background:'var(--bg3)', color:'var(--text3)', border:'1px dashed var(--border2)' }}>
                      {key === 'today' ? (
                        <span>No tasks for today. <button onClick={()=>openAdd(todayISO)} style={{ color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:0, fontSize:'inherit' }}>Add one?</button></span>
                      ) : 'Nothing here.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map(t => <TaskRow key={t.id} task={t} units={units} onEdit={()=>openEdit(t)} onDelete={()=>deletePlannerTask(t.id)} onToggle={()=>updatePlannerTask(t.id,{done:!t.done,status:t.done?'not-started':'complete'})} onStatusChange={s=>updatePlannerTask(t.id,{status:s,done:s==='complete'})} />)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card">
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--text3)' }}>Upcoming deadlines</div>
              {upcoming.length === 0
                ? <p className="text-xs" style={{ color:'var(--text3)' }}>Nothing coming up in 21 days.</p>
                : upcoming.map(a => {
                  const d = daysUntil(a.dueDate)
                  const unit = units.find(u=>u.id===a.unitId)
                  const col = d!<=2?'var(--red)':d!<=7?'var(--amber)':'var(--text3)'
                  return (
                    <div key={a.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom:'1px solid var(--border)' }}>
                      <div className="font-mono text-xs min-w-7 font-bold" style={{ color:col }}>{d}d</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color:'var(--text)' }}>{a.name}</div>
                        <div className="text-[10px]" style={{ color:'var(--text3)' }}>{unit?.code} · {fmtDate(a.dueDate)}</div>
                      </div>
                      <button onClick={()=>openAdd(a.dueDate ?? '')} style={{ background:'none', border:'1px solid var(--border2)', color:'var(--text3)', cursor:'pointer', borderRadius:6, fontSize:10, padding:'2px 6px' }}>Plan</button>
                    </div>
                  )
                })
              }
            </div>

            <div className="card">
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--text3)' }}>Today's progress</div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl font-bold" style={{ color:'var(--accent)' }}>{doneToday}/{totalToday}</div>
                <div className="text-xs" style={{ color:'var(--text3)' }}>tasks done</div>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height:6, background:'var(--bg4)' }}>
                <div className="h-full rounded-full transition-all" style={{ width:`${totalToday?Math.round(doneToday/totalToday*100):0}%`, background:'var(--accent)' }} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Board view */
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>w-1)}>← Prev</button>
            <span className="text-sm font-medium min-w-64 text-center" style={{ color:'var(--text)' }}>{weekLabel}</span>
            <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(w=>w+1)}>Next →</button>
            {weekOffset !== 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(0)}>Today</button>}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns:'repeat(7,1fr)' }}>
            {days.map((day, idx) => {
              const ds = isoFromDate(day)
              const isToday = ds === todayISO
              const dayTasks = plannerTasks.filter(t => t.date===ds)
              const dayDeadlines = assessments.filter(a => a.dueDate===ds && !['submitted','graded','complete'].includes(a.status))
              return (
                <div key={ds} className="rounded-xl p-3 min-h-40" style={{ background:'var(--bg3)', border:`1px solid ${isToday?'rgba(124,92,252,0.4)':'var(--border)'}` }}>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:isToday?'var(--accent)':'var(--text3)' }}>
                    {DAYS[idx]} {day.getDate()}
                  </div>
                  {dayDeadlines.map(a => {
                    const unit = units.find(u=>u.id===a.unitId)
                    return (
                      <div key={a.id} className="flex items-start gap-1.5 p-1.5 rounded-lg mb-1 text-xs" style={{ background:'var(--red-dim)', border:'1px solid rgba(240,82,82,0.2)' }}>
                        <div className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background:'var(--red)' }} />
                        <span style={{ color:'var(--text)' }}>{a.name}{unit?` (${unit.code})`:''}</span>
                      </div>
                    )
                  })}
                  {dayTasks.map(t => (
                    <div key={t.id} className="flex items-start gap-1.5 p-1.5 rounded-lg mb-1 text-xs cursor-pointer" style={{ background:'var(--bg4)', opacity:t.done?0.5:1 }}
                      onClick={()=>updatePlannerTask(t.id,{done:!t.done,status:t.done?'not-started':'complete'})}>
                      <div className="w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0" style={{ background: PRIORITY_COLOURS[t.priority] }} />
                      <span className="flex-1" style={{ color:'var(--text)', textDecoration:t.done?'line-through':'' }}>{t.name}</span>
                      <button onClick={e=>{e.stopPropagation();deletePlannerTask(t.id)}} style={{ background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:10,padding:0 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>openAdd(ds)} className="w-full mt-1 text-xs py-1 rounded-lg transition-colors"
                    style={{ background:'transparent',border:'1px dashed var(--border2)',color:'var(--text3)',cursor:'pointer' }}>+</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <TaskFormModal open={showForm} onClose={()=>{setShowForm(false);setEditingTask(null)}} defaultDate={defaultDate} editing={editingTask} />
    </div>
  )
}

function TaskRow({ task, units, onEdit, onDelete, onToggle, onStatusChange }: {
  task: PlannerTask
  units: ReturnType<typeof useStore.getState>['units']
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onStatusChange: (s: 'not-started'|'in-progress'|'complete') => void
}) {
  const unit = units.find(u => u.id === task.unitId)
  const isDone = task.done || task.status === 'complete'
  const status = task.status ?? (task.done ? 'complete' : 'not-started')

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 group" style={{ background:'var(--bg3)', border:'1px solid var(--border)', opacity: isDone ? 0.6 : 1 }}>
      {/* Done toggle */}
      <button onClick={onToggle} className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
        style={{ borderColor: isDone ? 'var(--green)' : 'var(--border2)', background: isDone ? 'var(--green)' : 'transparent' }}>
        {isDone && <span style={{ color:'#fff', fontSize:10 }}>✓</span>}
      </button>

      {/* Priority dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOURS[task.priority] }} />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium" style={{ color:'var(--text)', textDecoration: isDone ? 'line-through' : '' }}>{task.name}</span>
        <div className="flex items-center gap-2 mt-0.5">
          {unit && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background:'var(--bg4)', color: unit.colour }}>{unit.code}</span>}
          <span className="text-[10px]" style={{ color:'var(--text3)' }}>{task.date} · {task.estimatedHours}h</span>
          {task.notes && <span className="text-[10px] italic truncate max-w-xs" style={{ color:'var(--text3)' }}>{task.notes}</span>}
        </div>
      </div>

      {/* Status selector */}
      <select value={status} onChange={e=>onStatusChange(e.target.value as 'not-started'|'in-progress'|'complete')}
        className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background:'var(--bg4)', border:'1px solid var(--border2)', color: STATUS_COLOURS[status], cursor:'pointer' }}
        onClick={e=>e.stopPropagation()}>
        <option value="not-started">Not started</option>
        <option value="in-progress">In progress</option>
        <option value="complete">Complete</option>
      </select>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
          style={{ background:'var(--bg4)', border:'none', cursor:'pointer', color:'var(--text3)' }}>✎</button>
        <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
          style={{ background:'var(--bg4)', border:'none', cursor:'pointer', color:'var(--red)' }}>✕</button>
      </div>
    </div>
  )
}

function TaskFormModal({ open, onClose, defaultDate, editing }: {
  open: boolean; onClose: () => void; defaultDate: string; editing: PlannerTask | null
}) {
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const { addPlannerTask, updatePlannerTask } = useStore()

  const [name, setName] = useState(editing?.name ?? '')
  const [date, setDate] = useState(editing?.date ?? (defaultDate || isoFromDate(new Date())))
  const [unitId, setUnitId] = useState(editing?.unitId ?? '')
  const [assessmentId, setAssessmentId] = useState(editing?.assessmentId ?? '')
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? 'medium')
  const [status, setStatus] = useState<'not-started'|'in-progress'|'complete'>(editing?.status ?? 'not-started')
  const [hours, setHours] = useState(editing?.estimatedHours?.toString() ?? '1')
  const [notes, setNotes] = useState(editing?.notes ?? '')

  useMemo(() => {
    setName(editing?.name ?? '')
    setDate(editing?.date ?? (defaultDate || isoFromDate(new Date())))
    setUnitId(editing?.unitId ?? '')
    setAssessmentId(editing?.assessmentId ?? '')
    setPriority(editing?.priority ?? 'medium')
    setStatus(editing?.status ?? 'not-started')
    setHours(editing?.estimatedHours?.toString() ?? '1')
    setNotes(editing?.notes ?? '')
  }, [editing, defaultDate])

  const linkedAssessments = assessments.filter(a => !unitId || a.unitId === unitId)

  function save() {
    if (!name.trim()) { toast('Task name required','error'); return }
    const data = {
      name: name.trim(), date, unitId: unitId||null,
      assessmentId: assessmentId||null,
      priority, status, estimatedHours: parseFloat(hours)||1,
      done: status === 'complete', notes, aiGenerated: editing?.aiGenerated ?? false,
    }
    if (editing) { updatePlannerTask(editing.id, data); toast('Task updated','success') }
    else { addPlannerTask(data); toast('Task added','success') }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit task' : 'Add task'} size="sm">
      <Field label="Task name">
        <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Start Assignment 2 draft" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} /></Field>
        <Field label="Est. hours"><input type="number" className="input" value={hours} onChange={e=>setHours(e.target.value)} min={0.5} step={0.5} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select className="input" value={priority} onChange={e=>setPriority(e.target.value as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={status} onChange={e=>setStatus(e.target.value as typeof status)}>
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="complete">Complete</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit (optional)">
          <select className="input" value={unitId} onChange={e=>{setUnitId(e.target.value);setAssessmentId('')}}>
            <option value="">General</option>
            {units.map(u=><option key={u.id} value={u.id}>{u.code}</option>)}
          </select>
        </Field>
        <Field label="Linked assessment">
          <select className="input" value={assessmentId ?? ''} onChange={e=>setAssessmentId(e.target.value)}>
            <option value="">None</option>
            {linkedAssessments.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes (optional)">
        <input className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any context or subtasks..." />
      </Field>
      <ModalFooter>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{editing ? 'Save changes' : 'Add task'}</button>
      </ModalFooter>
    </Modal>
  )
}
