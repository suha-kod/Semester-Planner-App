'use client'

import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, useActiveSemester } from '@/lib/store'
import { currentWeekNumber, fmtDate, daysUntil } from '@/lib/weeks'
import { computeUnitRisk, computeCurrentMark, computeProjectedMark, neededMarkForTarget } from '@/lib/risk'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { DifficultyMeter, RiskBadge, StatusBadge, CountdownChip, EmptyState, SectionHeading, ProgressBar, Field, Pill, ConfirmDialog } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import { PlusIcon } from '@/components/layout/Icons'
import type { Unit, UnitType } from '@/types'

const WEEKLY_COMPONENTS = ['Lecture','Tutorial','Lab','Reading','Ed lesson','Discussion post','Practice questions','Weekly quiz','Notes / revision','Workshop']
const UNIT_COLOURS = ['#7c5cfc','#2dd4a0','#f5a623','#f05252','#60a5fa','#f472b6','#a78bfa','#34d399']

// ── Weekly Task Grid ──────────────────────────────────────────────────────────
function WeeklyTaskGrid({ unit, weeklyLogs, curWeek, totalWeeks, toggleWeeklyItem }: {
  unit: Unit
  weeklyLogs: ReturnType<typeof useStore.getState>['weeklyLogs']
  curWeek: number
  totalWeeks: number
  toggleWeeklyItem: (unitId: string, week: number, itemId: string) => void
}) {
  // All unique task labels (from the first week that has items)
  const labels = useMemo(() => {
    const seen = new Set<string>()
    weeklyLogs.forEach(l => l.items.forEach(i => { if (!seen.has(i.label)) seen.add(i.label) }))
    return Array.from(seen)
  }, [weeklyLogs])

  // Weeks that have logs configured, capped to totalWeeks
  const weeks = useMemo(() =>
    Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => weeklyLogs.some(l => l.week === w)),
    [weeklyLogs, totalWeeks]
  )

  function getItem(week: number, label: string) {
    return weeklyLogs.find(l => l.week === week)?.items.find(i => i.label === label) ?? null
  }

  function colDone(week: number) {
    const log = weeklyLogs.find(l => l.week === week)
    if (!log) return { done: 0, total: 0 }
    return { done: log.items.filter(i => i.done).length, total: log.items.length }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 140 + weeks.length * 52 }}>
        <colgroup>
          <col style={{ width: 140 }} />
          {weeks.map(w => <col key={w} style={{ width: 52 }} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Task
            </th>
            {weeks.map(w => {
              const isCur = w === curWeek
              const isFut = w > curWeek
              return (
                <th key={w} style={{
                  textAlign: 'center', padding: '5px 2px', fontSize: 10, fontWeight: 700,
                  color: isCur ? 'var(--accent)' : isFut ? 'var(--text3)' : 'var(--text2)',
                  background: isCur ? 'var(--accent-glow)' : 'transparent',
                  borderBottom: `2px solid ${isCur ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '4px 4px 0 0',
                }}>
                  W{w}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => (
            <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 8px', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {label}
              </td>
              {weeks.map(w => {
                const item = getItem(w, label)
                const isFut = w > curWeek
                const isCur = w === curWeek
                const done = item?.done ?? false
                return (
                  <td key={w} style={{ textAlign: 'center', padding: '4px 2px', background: isCur ? 'var(--accent-glow)' : 'transparent' }}>
                    <button
                      onClick={() => item && !isFut && toggleWeeklyItem(unit.id, w, item.id)}
                      style={{
                        width: 22, height: 22, borderRadius: 5, cursor: isFut || !item ? 'default' : 'pointer',
                        background: done ? unit.colour : 'transparent',
                        border: `1.5px solid ${done ? unit.colour : isFut ? 'var(--border)' : 'var(--border2)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isFut ? 0.3 : 1, transition: 'all 0.12s',
                        margin: '0 auto',
                      }}>
                      {done && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}

          {/* Footer: done/total per week */}
          <tr style={{ borderTop: '2px solid var(--border2)' }}>
            <td style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Done</td>
            {weeks.map(w => {
              const { done, total } = colDone(w)
              const isCur = w === curWeek
              const isFut = w > curWeek
              const allDone = total > 0 && done === total
              return (
                <td key={w} style={{ textAlign: 'center', padding: '4px 2px', fontSize: 9,
                  color: allDone ? 'var(--green)' : isFut ? 'var(--text3)' : 'var(--text2)',
                  background: isCur ? 'var(--accent-glow)' : 'transparent',
                }}>
                  {done}/{total}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function UnitsPage() {
  const units = useStore(s => s.units)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null)

  return (
    <div className="p-8 max-w-screen-xl">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-serif text-4xl font-light" style={{ color: 'var(--text)' }}>Units</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Your enrolled units and progress breakdown</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingUnit(null); setShowUnitForm(true) }}>
          <PlusIcon className="w-4 h-4" /> Add unit
        </button>
      </div>

      {units.length === 0
        ? <EmptyState icon="📚" title="No units added yet" description="Add your enrolled units to start tracking progress" action={<button className="btn btn-primary" onClick={() => setShowUnitForm(true)}>+ Add your first unit</button>} />
        : <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))' }}>
            {units.map(u => <UnitCard key={u.id} unit={u} onEdit={() => { setEditingUnit(u); setShowUnitForm(true) }} onDetail={() => setDetailUnit(u)} />)}
          </div>
      }

      <UnitFormModal open={showUnitForm} onClose={() => setShowUnitForm(false)} editing={editingUnit} />
      {detailUnit && <UnitDetailModal unit={detailUnit} onClose={() => setDetailUnit(null)} onEdit={() => { setEditingUnit(detailUnit); setDetailUnit(null); setShowUnitForm(true) }} />}
    </div>
  )
}

// ── Unit Card ─────────────────────────────────────────────────────────────────
function UnitCard({ unit, onEdit, onDetail }: { unit: Unit; onEdit: () => void; onDetail: () => void }) {
  const assessments = useStore(useShallow(s => s.assessments.filter(a => a.unitId === unit.id)))
  const weeklyLogs = useStore(useShallow(s => s.weeklyLogs.filter(l => l.unitId === unit.id)))
  const semester = useActiveSemester()
  const curWeek = currentWeekNumber(semester)
  const risk = useMemo(() => computeUnitRisk(unit, assessments, weeklyLogs, curWeek), [unit, assessments, weeklyLogs, curWeek])
  const mark = computeCurrentMark(assessments)

  const logs = weeklyLogs.filter(l => l.week === curWeek)
  const total = logs.reduce((s,l) => s + l.items.length, 0)
  const done  = logs.reduce((s,l) => s + l.items.filter(i=>i.done).length, 0)
  const pct   = total > 0 ? Math.round(done/total*100) : null

  const upcoming = assessments.filter(a => { const d = daysUntil(a.dueDate); return d !== null && d >= 0 && d <= 14 && !['submitted','graded','complete'].includes(a.status) })

  const riskColour = risk.level === 'low' ? 'var(--green)' : risk.level === 'medium' ? 'var(--amber)' : 'var(--red)'

  return (
    <div
      className="rounded-xl p-5 cursor-pointer transition-all relative overflow-hidden"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: `3px solid ${riskColour}` }}
      onClick={onDetail}
    >
      <div className="text-xs font-mono mb-1" style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>{unit.code}</div>
      <div className="text-base font-medium mb-3" style={{ color: 'var(--text)' }}>{unit.name}</div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <RiskBadge level={risk.level} />
        {mark !== null && <span className="chip chip-future font-mono">{mark.toFixed(1)}%</span>}
        {unit.targetMark && <span className="text-xs" style={{ color: 'var(--text3)' }}>Target: {unit.targetMark}%</span>}
      </div>

      <DifficultyMeter value={unit.difficulty} />

      {pct !== null ? (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: 'var(--text2)' }}>Week {curWeek} completion</span>
            <span className="font-mono" style={{ color: 'var(--text2)' }}>{done}/{total}</span>
          </div>
          <ProgressBar value={pct} colour={pct>=80?'green':pct>=50?'accent':'amber'} />
        </div>
      ) : (
        <p className="text-xs mt-3" style={{ color: 'var(--text3)' }}>No weekly tasks for this week</p>
      )}

      <div className="flex justify-between mt-3 text-xs" style={{ color: 'var(--text3)' }}>
        <span>{assessments.length} assessment{assessments.length !== 1 ? 's' : ''}</span>
        {upcoming.length > 0 && <span style={{ color: 'var(--amber)' }}>{upcoming.length} due soon</span>}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onEdit() }}
        className="absolute top-3 right-3 btn btn-ghost btn-sm btn-icon text-xs"
        style={{ opacity: 0.6 }}
      >✎</button>
    </div>
  )
}

// ── Unit Form Modal ───────────────────────────────────────────────────────────
function UnitFormModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Unit | null }) {
  const { addUnit, updateUnit, deleteUnit, units } = useStore()
  const semester = useActiveSemester()

  const [code, setCode] = useState(editing?.code ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [difficulty, setDifficulty] = useState(editing?.difficulty ?? 5)
  const [type, setType] = useState<UnitType>(editing?.type ?? 'mixed')
  const [targetMark, setTargetMark] = useState(editing?.targetMark?.toString() ?? '')
  const [credits, setCredits] = useState(editing?.credits ?? 10)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset when editing changes
  useMemo(() => {
    setCode(editing?.code ?? '')
    setName(editing?.name ?? '')
    setDifficulty(editing?.difficulty ?? 5)
    setType(editing?.type ?? 'mixed')
    setTargetMark(editing?.targetMark?.toString() ?? '')
    setCredits(editing?.credits ?? 10)
    setNotes(editing?.notes ?? '')
  }, [editing])

  function save() {
    if (!code.trim() || !name.trim()) { toast('Code and name are required', 'error'); return }
    const data = {
      code: code.trim().toUpperCase(), name: name.trim(),
      difficulty, type, targetMark: targetMark ? parseFloat(targetMark) : null,
      credits, notes: notes.trim(),
      semesterId: semester?.id ?? '',
      colour: UNIT_COLOURS[units.length % UNIT_COLOURS.length],
    }
    if (editing) { updateUnit(editing.id, data); toast('Unit updated', 'success') }
    else { addUnit(data); toast('Unit added', 'success') }
    onClose()
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={editing ? 'Edit unit' : 'Add unit'} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit code"><input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="COMP1000" /></Field>
          <Field label="Unit name"><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Introduction to Computing" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Difficulty: ${difficulty}/10`}>
            <input type="range" min={1} max={10} value={difficulty} onChange={e=>setDifficulty(parseInt(e.target.value))} className="w-full mt-1" style={{ accentColor: 'var(--accent)' }} />
          </Field>
          <Field label="Unit type">
            <select className="input" value={type} onChange={e=>setType(e.target.value as UnitType)}>
              <option value="mixed">Mixed</option>
              <option value="assignment-heavy">Assignment heavy</option>
              <option value="exam-heavy">Exam heavy</option>
              <option value="concept-heavy">Concept heavy</option>
              <option value="lab-heavy">Lab heavy</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target mark (%)"><input type="number" className="input" value={targetMark} onChange={e=>setTargetMark(e.target.value)} placeholder="e.g. 80" min={0} max={100} /></Field>
          <Field label="Credit points"><input type="number" className="input" value={credits} onChange={e=>setCredits(parseInt(e.target.value)||10)} min={1} max={30} /></Field>
        </div>
        <Field label="Notes / grading rules"><textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Must pass exam to pass unit. Best 8 of 12 quizzes counted." /></Field>
        <ModalFooter>
          {editing && <button className="btn btn-danger btn-sm mr-auto" onClick={()=>setConfirmDelete(true)}>Delete unit</button>}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{editing ? 'Save changes' : 'Add unit'}</button>
        </ModalFooter>
      </Modal>
      <ConfirmDialog open={confirmDelete} onCancel={()=>setConfirmDelete(false)} onConfirm={()=>{ deleteUnit(editing!.id); setConfirmDelete(false); onClose(); toast('Unit deleted','info') }} title="Delete unit" message={`Delete "${editing?.name}" and all its assessments and weekly logs? This cannot be undone.`} confirmLabel="Delete" danger />
    </>
  )
}

// ── Unit Detail Modal ─────────────────────────────────────────────────────────
function UnitDetailModal({ unit, onClose, onEdit }: { unit: Unit; onClose: () => void; onEdit: () => void }) {
  const assessments = useStore(useShallow(s => s.assessments.filter(a => a.unitId === unit.id)))
  const weeklyLogs = useStore(useShallow(s => s.weeklyLogs.filter(l => l.unitId === unit.id)))
  const { setWeeklyItems, toggleWeeklyItem } = useStore()
  const semester = useActiveSemester()
  const curWeek = currentWeekNumber(semester)

  const risk = computeUnitRisk(unit, assessments, weeklyLogs, curWeek)
  const mark = computeCurrentMark(assessments)
  const projected = computeProjectedMark(assessments)
  const needed = neededMarkForTarget(unit, assessments)

  const [showWeeklySetup, setShowWeeklySetup] = useState(false)
  const [setupWeek, setSetupWeek] = useState(curWeek)
  const [selectedComps, setSelectedComps] = useState<string[]>([])
  const [customComps, setCustomComps] = useState('')

  function applyWeekly() {
    const customs = customComps.split(',').map(s=>s.trim()).filter(Boolean)
    const all = [...selectedComps, ...customs]
    if (all.length === 0) { toast('Select at least one component','error'); return }
    for (let w = setupWeek; w <= (semester?.totalWeeks ?? 13); w++) {
      setWeeklyItems(unit.id, w, all)
    }
    toast('Weekly tasks applied','success')
    setShowWeeklySetup(false)
  }

  return (
    <Modal open title={unit.name} subtitle={unit.code} onClose={onClose} size="xl">
      <div className="flex items-center gap-3 mb-1">
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>Edit unit</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 my-5">
        <div className="rounded-xl p-4 text-center" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
          <div className="section-heading mb-1">Current mark</div>
          <div className="font-mono text-2xl font-semibold" style={{ color: mark!==null?(mark>=70?'var(--green)':mark>=50?'var(--amber)':'var(--red)'):'var(--text2)' }}>{mark!==null?mark.toFixed(1)+'%':'—'}</div>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
          <div className="section-heading mb-1">Target</div>
          <div className="font-mono text-2xl font-semibold" style={{ color:'var(--accent)' }}>{unit.targetMark?unit.targetMark+'%':'—'}</div>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
          <div className="section-heading mb-1">Projected</div>
          <div className="font-mono text-2xl font-semibold" style={{ color:'var(--text)' }}>{projected!==null?projected.toFixed(1)+'%':'—'}</div>
          <div className="text-[10px] mt-0.5" style={{ color:'var(--text3)' }}>65% on remaining</div>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
          <div className="section-heading mb-1">Risk</div>
          <div className="mt-1"><RiskBadge level={risk.level} /></div>
          <div className="text-[10px] mt-1" style={{ color:'var(--text3)' }}>{risk.reasons[0]||'on track'}</div>
        </div>
      </div>

      {needed !== null && (
        <div className="rounded-xl p-3 mb-5 text-sm" style={{ background:'var(--accent-glow)', border:'1px solid rgba(124,92,252,0.2)', color:'var(--accent)' }}>
          Need <strong>{Math.max(0,needed).toFixed(1)}%</strong> avg on remaining assessments to reach {unit.targetMark}%
          {needed > 100 && ' — ⚠ not achievable at current pace'}
          {needed < 0 && ' — ✓ already achieved!'}
        </div>
      )}

      {/* Assessments */}
      <SectionHeading>Assessments</SectionHeading>
      {assessments.length === 0
        ? <p className="text-sm mb-4" style={{ color:'var(--text3)' }}>No assessments added for this unit.</p>
        : assessments.map(a => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{ background:'var(--bg3)' }}>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color:'var(--text)' }}>{a.name}</div>
              <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>{a.type} · {a.weight}% weight{a.specialRules?` · ${a.specialRules}`:''}</div>
            </div>
            <CountdownChip dateStr={a.dueDate} />
            {a.mark !== null && a.mark !== undefined && <span className="font-mono text-sm" style={{ color:'var(--teal)' }}>{a.mark}/{a.maxMark}</span>}
            <StatusBadge status={a.status} />
          </div>
        ))
      }

      {/* Weekly tasks */}
      <div className="mt-5">
        <SectionHeading action={<button className="btn btn-ghost btn-sm" onClick={()=>setShowWeeklySetup(s=>!s)}>Configure</button>}>
          Weekly tasks
        </SectionHeading>

        {showWeeklySetup && (
          <div className="rounded-xl p-4 mb-4" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Apply from week">
                <select className="input" value={setupWeek} onChange={e=>setSetupWeek(parseInt(e.target.value))}>
                  {Array.from({length:semester?.totalWeeks??13},(_,i)=><option key={i+1} value={i+1}>Week {i+1}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {WEEKLY_COMPONENTS.map(c=><Pill key={c} label={c} selected={selectedComps.includes(c)} onClick={()=>setSelectedComps(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c])} />)}
            </div>
            <Field label="Custom items (comma-separated)">
              <input className="input" value={customComps} onChange={e=>setCustomComps(e.target.value)} placeholder="e.g. Problem set" />
            </Field>
            <button className="btn btn-primary btn-sm" onClick={applyWeekly}>Apply to all remaining weeks</button>
          </div>
        )}

        {weeklyLogs.length === 0
          ? <p className="text-sm" style={{ color:'var(--text3)' }}>No tasks configured. Click Configure to set up weekly tracking.</p>
          : <WeeklyTaskGrid
              unit={unit}
              weeklyLogs={weeklyLogs}
              curWeek={curWeek}
              totalWeeks={semester?.totalWeeks ?? 13}
              toggleWeeklyItem={toggleWeeklyItem}
            />
        }
      </div>

      {unit.notes && (
        <div className="mt-5">
          <div className="divider" />
          <SectionHeading>Notes</SectionHeading>
          <p className="text-sm" style={{ color:'var(--text2)', lineHeight:1.6 }}>{unit.notes}</p>
        </div>
      )}
    </Modal>
  )
}
