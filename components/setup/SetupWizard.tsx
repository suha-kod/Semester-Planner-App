'use client'

import { useState, useRef } from 'react'
import { useStore } from '@/lib/store'
import { toast } from '../ui/Toast'
import { Field, Pill } from '../ui/index'
import type { Unit, AssessmentType } from '@/types'

const ASSESS_TYPES: AssessmentType[] = ['assignment','quiz','exam','midsem','lab','presentation','group','participation','hurdle','other']
const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

interface AssessEntry {
  id: string
  name: string
  type: AssessmentType
  weight: string
  dueDate: string
  maxMark: string
  specialRules: string
  isWeeklyQuiz: boolean
  quizWeeks: number[]
  quizDay: string
  quizTime: string
}

function blankAssess(id: string): AssessEntry {
  return { id, name:'', type:'assignment', weight:'', dueDate:'', maxMark:'100', specialRules:'', isWeeklyQuiz:false, quizWeeks:[], quizDay:'Wednesday', quizTime:'12:00' }
}

function teachingWeekDate(semStart: string, breakWeeks: number[], teachingWeek: number, dayName: string): string {
  const start = new Date(semStart)
  const dow = start.getDay()
  const toMon = dow === 0 ? -6 : 1 - dow
  const startMon = new Date(start); startMon.setDate(start.getDate() + toMon)
  let calWeek = 1, tWeek = 0
  while (tWeek < teachingWeek) {
    if (!breakWeeks.includes(calWeek)) tWeek++
    if (tWeek === teachingWeek) break
    calWeek++
  }
  const weekMon = new Date(startMon); weekMon.setDate(startMon.getDate() + (calWeek - 1) * 7)
  const dayIdx = DAYS_OF_WEEK.indexOf(dayName)
  weekMon.setDate(weekMon.getDate() + (dayIdx === -1 ? 0 : dayIdx))
  return weekMon.toISOString().split('T')[0]
}

const UNIT_COLOURS = ['#ec4899','#2dd4a0','#f5a623','#f05252','#60a5fa','#f472b6','#f9a8d4','#34d399']
const HABIT_COLOURS = ['#ec4899','#2dd4a0','#f5a623','#f05252','#60a5fa','#f472b6','#f9a8d4','#34d399','#fb923c','#e879f9']

const SUGGESTED_HABITS: { emoji: string; title: string; colour: string }[] = [
  { emoji:'⏰', title:'Wake up early',    colour:'#f5a623' },
  { emoji:'🏃', title:'Exercise',         colour:'#2dd4a0' },
  { emoji:'📖', title:'Read',             colour:'#60a5fa' },
  { emoji:'✍️', title:'Journal',          colour:'#f9a8d4' },
  { emoji:'🧘', title:'Meditate',         colour:'#34d399' },
  { emoji:'📵', title:'No phone in AM',   colour:'#f472b6' },
  { emoji:'🚿', title:'Cold shower',      colour:'#60a5fa' },
  { emoji:'🎯', title:'Plan top 3',       colour:'#f5a623' },
  { emoji:'💪', title:'Deep work',        colour:'#ec4899' },
  { emoji:'💧', title:'Drink water',      colour:'#2dd4a0' },
  { emoji:'🥗', title:'Healthy eating',   colour:'#34d399' },
  { emoji:'😴', title:'Sleep by 11pm',    colour:'#f9a8d4' },
  { emoji:'📚', title:'Lecture',          colour:'#ec4899' },
  { emoji:'💡', title:'Tutorial',         colour:'#2dd4a0' },
  { emoji:'🧠', title:'Practice Qs',      colour:'#f05252' },
  { emoji:'🖊️', title:'Revision notes',  colour:'#60a5fa' },
]

const WEEKLY_COMPONENTS = [
  'Lecture','Tutorial','Lab','Reading','Ed lesson',
  'Discussion post','Practice questions','Weekly quiz',
  'Notes / revision','Workshop',
]

interface Props { onComplete: () => void }

export function SetupWizard({ onComplete }: Props) {
  const { updateProfile, updateSemester, addUnit, setWeeklyItems } = useStore()
  const semesters = useStore(s => s.semesters)
  const activeSemesterId = useStore(s => s.activeSemesterId)

  const [step, setStep] = useState(1)
  const TOTAL = 6

  // Step 1 — profile + semester
  const [name, setName] = useState('')
  const [semName, setSemName] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 4); return d.toISOString().split('T')[0]
  })
  const [totalWeeks, setTotalWeeks] = useState(13)
  const [gradeGoal, setGradeGoal] = useState('')
  const [breakWeeks, setBreakWeeks] = useState<number[]>([])

  // Step 2 — units
  const [unitForms, setUnitForms] = useState([blankUnit(0)])

  // Step 3 — assessments per unit
  const [unitAssessments, setUnitAssessments] = useState<Record<number, AssessEntry[]>>({})
  const [activeAssessUnit, setActiveAssessUnit] = useState(0)

  // Step 4 — weekly structure per unit
  const [savedUnits, setSavedUnits] = useState<Unit[]>([])
  const [weeklyUnit, setWeeklyUnit] = useState(0)
  const [weeklySelections, setWeeklySelections] = useState<Record<number, string[]>>({})
  const [weeklyCustom, setWeeklyCustom] = useState<Record<number, string>>({})

  // Step 4 — daily habits
  const [selectedHabits, setSelectedHabits] = useState<Set<string>>(
    new Set(['Wake up early','Exercise','Read','Deep work'])
  )
  const [customHabitInput, setCustomHabitInput] = useState('')
  const [customHabits, setCustomHabits] = useState<{ emoji: string; title: string; colour: string }[]>([])
  const [habitStartDate, setHabitStartDate] = useState(() => new Date().toISOString().split('T')[0])

  // Step 5 — preferences
  const [studyDays, setStudyDays] = useState(['Mon','Tue','Wed','Thu','Fri'])
  const [weeklyHours, setWeeklyHours] = useState(20)
  const [studyStyle, setStudyStyle] = useState<'early'|'steady'|'deadline'|'exam'>('deadline')

  // Outline extraction
  const [extractingUnit, setExtractingUnit] = useState<number | null>(null)
  const [extractedAssessments, setExtractedAssessments] = useState<Record<number, any[]>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingExtractIdx, setPendingExtractIdx] = useState<number | null>(null)

  async function extractOutline(unitIdx: number, files: File[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) { toast('Please select an image file', 'error'); return }
    setExtractingUnit(unitIdx)
    try {
      const images = await Promise.all(imageFiles.map(f => new Promise<{ data: string; mediaType: string }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          resolve({ data: dataUrl.split(',')[1], mediaType: f.type })
        }
        reader.onerror = reject
        reader.readAsDataURL(f)
      })))
      const res = await fetch('/api/extract-assessments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ images }) })
      const json = await res.json()
      if (!res.ok) { toast(json.error || 'Extraction failed', 'error'); return }
      if (!json.assessments?.length) { toast('No assessments found', 'info'); return }
      setExtractedAssessments(prev => ({ ...prev, [unitIdx]: json.assessments }))
      toast(`Found ${json.assessments.length} assessment${json.assessments.length > 1 ? 's' : ''}`, 'success')
    } catch (e: any) {
      toast(e.message || 'Extraction failed', 'error')
    } finally {
      setExtractingUnit(null)
    }
  }

  function blankUnit(idx: number) {
    return { code: '', name: '', difficulty: 5, type: 'mixed' as const, targetMark: '', credits: 10, notes: '', colour: UNIT_COLOURS[idx % UNIT_COLOURS.length] }
  }

  function nextStep() {
    try {
      if (step === 1) {
        if (!semName.trim()) { toast('Please enter a semester name', 'error'); return }
      }

      if (step === 2) {
        const valid = unitForms.filter(u => u.code.trim() && u.name.trim())
        if (valid.length === 0) { toast('Add at least one unit', 'error'); return }
        const { deleteUnit } = useStore.getState()
        savedUnits.forEach(u => deleteUnit(u.id))
        const added: Unit[] = []
        valid.forEach((u, i) => {
          const newU = addUnit({
            semesterId: activeSemesterId,
            code: u.code.trim().toUpperCase(),
            name: u.name.trim(),
            difficulty: u.difficulty,
            type: u.type,
            targetMark: u.targetMark ? parseFloat(u.targetMark) : null,
            credits: u.credits,
            notes: u.notes,
            colour: UNIT_COLOURS[i % UNIT_COLOURS.length],
          })
          added.push(newU)
        })
        setSavedUnits(added)
        // Pre-populate assessments from extracted outlines
        const initAssess: Record<number, AssessEntry[]> = {}
        let vi = 0
        unitForms.forEach((u, origIdx) => {
          if (!u.code.trim() || !u.name.trim()) return
          const extracted = extractedAssessments[origIdx] ?? []
          initAssess[vi] = extracted.map((a: any, j: number) => ({
            id: `ea_${vi}_${j}`, name: a.name ?? '', type: a.type ?? 'assignment',
            weight: a.weight?.toString() ?? '0', dueDate: a.dueDate ?? '',
            maxMark: a.maxMark?.toString() ?? '100', specialRules: a.specialRules ?? '',
            isWeeklyQuiz: false, quizWeeks: [], quizDay: 'Wednesday', quizTime: '12:00',
          }))
          vi++
        })
        setUnitAssessments(initAssess)
        setActiveAssessUnit(0)
        const initSel: Record<number, string[]> = {}
        added.forEach((_, i) => { initSel[i] = [] })
        setWeeklySelections(initSel)
        setStep(3)
        return
      }

      if (step === 3) {
        // Assessments step — just advance (data lives in unitAssessments state)
        setStep(4)
        return
      }

      if (step === 4) {
        savedUnits.forEach((unit, i) => {
          const selected = weeklySelections[i] ?? []
          const customs = (weeklyCustom[i] ?? '').split(',').map(s => s.trim()).filter(Boolean)
          const all = [...selected, ...customs]
          if (all.length > 0) {
            for (let w = 1; w <= totalWeeks; w++) {
              setWeeklyItems(unit.id, w, all)
            }
          }
        })
        setStep(5)
        return
      }

      if (step === 5) {
        const { habits, deleteHabit, addHabit } = useStore.getState()
        const today = new Date().toISOString().split('T')[0]
        habits.forEach(h => deleteHabit(h.id))
        const allHabits = [
          ...SUGGESTED_HABITS.filter(s => selectedHabits.has(s.title)),
          ...customHabits,
        ]
        allHabits.forEach((h) => {
          addHabit({ title: h.title, emoji: h.emoji, colour: h.colour, unitId: null, frequency: 'daily', targetCount: 1, active: true, createdAt: today })
        })
        updateProfile({ habitStartDate })
        setStep(6)
        return
      }

      if (step === 6) {
        updateProfile({ name: name.trim(), studyDays, weeklyHoursTarget: weeklyHours, studyStyle })
        updateSemester({ name: semName.trim(), startDate, endDate, totalWeeks, breakWeeks, gradeGoal: gradeGoal as any })
        const { addAssessment } = useStore.getState()
        savedUnits.forEach((unit, i) => {
          const entries = unitAssessments[i] ?? []
          entries.forEach(entry => {
            if (!entry.name.trim()) return
            if (entry.isWeeklyQuiz && entry.quizWeeks.length > 0) {
              const timeNote = entry.quizTime ? ` · Due ${entry.quizTime}` : ''
              ;[...entry.quizWeeks].sort((a,b)=>a-b).forEach(w => {
                addAssessment({
                  name: `${entry.name.trim()} — Week ${w}`, unitId: unit.id, type: 'quiz',
                  weight: parseFloat(entry.weight) || 0, status: 'not-started',
                  dueDate: teachingWeekDate(startDate, breakWeeks, w, entry.quizDay),
                  personalDueDate: null, mark: null, maxMark: parseFloat(entry.maxMark) || 100,
                  specialRules: `${entry.quizDay}${timeNote}${entry.specialRules ? ` · ${entry.specialRules}` : ''}`, notes: '',
                })
              })
            } else {
              addAssessment({
                name: entry.name.trim(), unitId: unit.id, type: entry.type,
                weight: parseFloat(entry.weight) || 0, status: 'not-started',
                dueDate: entry.dueDate || null, personalDueDate: null,
                mark: null, maxMark: parseFloat(entry.maxMark) || 100,
                specialRules: entry.specialRules, notes: '',
              })
            }
          })
        })
        toast(`Welcome to Tracker, ${name || 'there'}! 🎓`, 'success')
        onComplete()
        return
      }

      setStep(s => s + 1)
    } catch (e: any) {
      toast(`Error: ${e?.message || 'Something went wrong'}`, 'error')
      console.error('nextStep error:', e)
    }
  }

  function toggleDay(day: string) {
    setStudyDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function toggleWeeklyComp(unitIdx: number, comp: string) {
    setWeeklySelections(prev => {
      const cur = prev[unitIdx] ?? []
      return { ...prev, [unitIdx]: cur.includes(comp) ? cur.filter(c => c !== comp) : [...cur, comp] }
    })
  }

  const pct = Math.round((step / TOTAL) * 100)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-10 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-serif text-lg" style={{ color: 'var(--text)' }}>Tracker Setup</div>
        <div className="text-xs" style={{ color: 'var(--text3)' }}>Step {step} of {TOTAL}</div>
      </div>

      {/* Progress */}
      <div className="h-0.5 w-full" style={{ background: 'var(--bg4)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-10 py-12">

          {/* ── Step 1: Semester ── */}
          {step === 1 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 01 / 0{TOTAL}</div>
              <h1 className="font-serif text-4xl font-light mb-2" style={{ color: 'var(--text)' }}>Welcome to Tracker</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
                Let's set up your semester in about 5 minutes. Everything can be edited later.
              </p>

              {/* Existing data shortcut */}
              <div className="rounded-xl p-4 mb-8 flex items-center justify-between gap-4" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                <div>
                  <div className="text-sm font-medium mb-0.5" style={{ color:'var(--text)' }}>Already have data?</div>
                  <div className="text-xs" style={{ color:'var(--text3)' }}>Skip setup and paste your backup in Settings.</div>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ whiteSpace:'nowrap' }} onClick={onComplete}>
                  Skip setup →
                </button>
              </div>
              <Field label="Your name">
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Suha" />
              </Field>
              <Field label="Semester name">
                <input className="input" value={semName} onChange={e => setSemName(e.target.value)} placeholder="e.g. Semester 1, 2026" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </Field>
                <Field label="End date">
                  <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teaching weeks (excl. breaks)">
                  <input type="number" className="input" value={totalWeeks} onChange={e => setTotalWeeks(parseInt(e.target.value) || 13)} min={1} max={30} />
                </Field>
                <Field label="Overall goal">
                  <select className="input" value={gradeGoal} onChange={e => setGradeGoal(e.target.value)}>
                    <option value="">No specific goal</option>
                    <option value="HD">HD — High Distinction (85%+)</option>
                    <option value="D">D — Distinction (75%+)</option>
                    <option value="CR">CR — Credit (65%+)</option>
                    <option value="P">P — Pass (50%+)</option>
                  </select>
                </Field>
              </div>

              {/* Break / non-teaching weeks */}
              {startDate && endDate && (() => {
                const calWeeks = Math.max(totalWeeks + 2, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (7 * 86400000)) + 1)
                return (
                  <div className="mt-1">
                    <div className="text-xs font-semibold mb-1" style={{ color:'var(--text2)' }}>
                      Mid-sem breaks / non-teaching weeks
                    </div>
                    <div className="text-xs mb-2" style={{ color:'var(--text3)' }}>
                      Tick any calendar weeks (from semester start) that are breaks — Tracker skips these in the week counter.
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-xl" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                      {Array.from({ length: calWeeks }, (_, i) => i + 1).map(w => {
                        const checked = breakWeeks.includes(w)
                        return (
                          <label key={w} className="flex items-center gap-1 cursor-pointer" style={{ fontSize:11, color: checked ? 'var(--accent)' : 'var(--text2)' }}>
                            <input type="checkbox" checked={checked} onChange={() => setBreakWeeks(p => checked ? p.filter(x => x !== w) : [...p, w].sort((a,b)=>a-b))} style={{ accentColor:'var(--accent)' }} />
                            Wk {w}
                          </label>
                        )
                      })}
                    </div>
                    {breakWeeks.length > 0 && (
                      <div className="text-xs mt-1.5" style={{ color:'var(--accent)' }}>
                        {breakWeeks.length} break week{breakWeeks.length !== 1 ? 's' : ''} selected · {totalWeeks} teaching weeks
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Step 2: Units ── */}
          {step === 2 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 02 / 0{TOTAL}</div>
              <h1 className="font-serif text-4xl font-light mb-2" style={{ color: 'var(--text)' }}>Your units</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
                Add each unit you're enrolled in. Difficulty rating drives risk analysis and recommendations.
              </p>
              {unitForms.map((u, i) => (
                <div key={i} className="rounded-xl p-4 mb-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Field label="Unit code">
                      <input className="input" value={u.code} onChange={e => { const f = [...unitForms]; f[i] = { ...f[i], code: e.target.value }; setUnitForms(f) }} placeholder="COMP1000" />
                    </Field>
                    <Field label="Unit name">
                      <input className="input" value={u.name} onChange={e => { const f = [...unitForms]; f[i] = { ...f[i], name: e.target.value }; setUnitForms(f) }} placeholder="Introduction to Computing" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Difficulty: ${u.difficulty}/10`}>
                      <input type="range" min={1} max={10} value={u.difficulty}
                        onChange={e => { const f = [...unitForms]; f[i] = { ...f[i], difficulty: parseInt(e.target.value) }; setUnitForms(f) }}
                        className="w-full mt-1" style={{ accentColor: 'var(--accent)' }} />
                    </Field>
                    <Field label="Target mark (%)">
                      <input type="number" className="input" value={u.targetMark} onChange={e => { const f = [...unitForms]; f[i] = { ...f[i], targetMark: e.target.value }; setUnitForms(f) }} placeholder="e.g. 80" min={0} max={100} />
                    </Field>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop:'1px solid var(--border)' }}>
                    <div className="text-xs" style={{ color:'var(--text3)' }}>
                      {extractedAssessments[i]?.length
                        ? <span style={{ color:'var(--teal)' }}>✓ {extractedAssessments[i].length} assessments will be imported</span>
                        : 'Optional: extract assessments from unit outline'}
                    </div>
                    <div className="flex items-center gap-2">
                      {extractingUnit === i && <span className="text-xs" style={{ color:'var(--accent)' }}>Extracting...</span>}
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={extractingUnit === i}
                        onClick={() => { setPendingExtractIdx(i); fileInputRef.current?.click() }}
                      >Upload outline</button>
                    </div>
                  </div>
                  {extractedAssessments[i]?.length > 0 && (
                    <div className="mt-2 rounded-lg p-2" style={{ background:'var(--bg4)', fontSize:11 }}>
                      {extractedAssessments[i].map((a, ai) => (
                        <div key={ai} className="flex justify-between py-0.5" style={{ color:'var(--text2)' }}>
                          <span>{a.name}</span>
                          <span style={{ color:'var(--text3)' }}>{a.weight}% · {a.dueDate ?? 'TBA'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {unitForms.length > 1 && (
                    <button className="btn btn-danger btn-sm mt-2" onClick={() => setUnitForms(unitForms.filter((_, j) => j !== i))}>Remove</button>
                  )}
                </div>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display:'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length && pendingExtractIdx !== null) extractOutline(pendingExtractIdx, files)
                  e.target.value = ''
                }}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => setUnitForms([...unitForms, blankUnit(unitForms.length)])}>
                + Add unit
              </button>
            </div>
          )}

          {/* ── Step 3: Assessments ── */}
          {step === 3 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 03 / 0{TOTAL}</div>
              <h1 className="font-serif text-4xl font-light mb-2" style={{ color: 'var(--text)' }}>Assessments</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
                Add assessments for each unit. Tracker tracks deadlines, weights, and grades.
              </p>

              {/* Unit tabs */}
              <div className="flex gap-2 flex-wrap mb-5">
                {savedUnits.map((u, i) => (
                  <button key={u.id} onClick={() => setActiveAssessUnit(i)} className="btn btn-sm" style={{
                    background: activeAssessUnit === i ? 'var(--accent-glow)' : 'var(--bg3)',
                    border: `1px solid ${activeAssessUnit === i ? 'var(--accent)' : 'var(--border2)'}`,
                    color: activeAssessUnit === i ? 'var(--accent)' : 'var(--text2)',
                  }}>{u.code}</button>
                ))}
              </div>

              {/* Assessment list for active unit */}
              {savedUnits[activeAssessUnit] && (() => {
                const entries = unitAssessments[activeAssessUnit] ?? []
                const setEntries = (fn: (prev: AssessEntry[]) => AssessEntry[]) =>
                  setUnitAssessments(prev => ({ ...prev, [activeAssessUnit]: fn(prev[activeAssessUnit] ?? []) }))
                const uid = `${activeAssessUnit}`

                return (
                  <div>
                    {entries.length === 0 && (
                      <p className="text-sm mb-4" style={{ color:'var(--text3)' }}>No assessments yet — add one below.</p>
                    )}

                    {entries.map((entry, ei) => (
                      <div key={entry.id} className="rounded-xl p-4 mb-3" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <Field label="Assessment name">
                            <input className="input" value={entry.name} placeholder="e.g. Assignment 1"
                              onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, name:e.target.value} : x))} />
                          </Field>
                          <Field label="Type">
                            <select className="input" value={entry.type}
                              onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, type:e.target.value as AssessmentType, isWeeklyQuiz: e.target.value!=='quiz' ? false : x.isWeeklyQuiz} : x))}>
                              {ASSESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <Field label="Weight (%)">
                            <input type="number" className="input" value={entry.weight} placeholder="30" min={0} max={100}
                              onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, weight:e.target.value} : x))} />
                          </Field>
                          <Field label="Max mark">
                            <input type="number" className="input" value={entry.maxMark} min={1}
                              onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, maxMark:e.target.value} : x))} />
                          </Field>
                          {!entry.isWeeklyQuiz && (
                            <Field label="Due date">
                              <input type="date" className="input" value={entry.dueDate}
                                onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, dueDate:e.target.value} : x))} />
                            </Field>
                          )}
                        </div>

                        {/* Weekly quiz toggle */}
                        {entry.type === 'quiz' && (
                          <div className="rounded-lg p-3 mb-2" style={{ background:'var(--bg4)', border:'1px solid var(--border)' }}>
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                              <input type="checkbox" checked={entry.isWeeklyQuiz} style={{ accentColor:'var(--accent)' }}
                                onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, isWeeklyQuiz:e.target.checked} : x))} />
                              <span className="text-xs font-semibold" style={{ color:'var(--text)' }}>Weekly quiz</span>
                              <span className="text-xs" style={{ color:'var(--text3)' }}>generates one entry per selected week</span>
                            </label>
                            {entry.isWeeklyQuiz && (
                              <>
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {Array.from({length: totalWeeks}, (_,i)=>i+1).map(w => {
                                    const sel = entry.quizWeeks.includes(w)
                                    return <button key={w} type="button"
                                      onClick={() => setEntries(p => p.map((x,j) => j===ei ? {...x, quizWeeks: sel ? x.quizWeeks.filter(v=>v!==w) : [...x.quizWeeks,w]} : x))}
                                      style={{ padding:'2px 7px', borderRadius:5, fontSize:10, cursor:'pointer',
                                        background: sel ? 'var(--accent)' : 'var(--bg3)',
                                        color: sel ? '#fff' : 'var(--text2)',
                                        border:`1px solid ${sel ? 'var(--accent)' : 'var(--border2)'}` }}>W{w}</button>
                                  })}
                                  <button type="button" onClick={() => setEntries(p => p.map((x,j) => j===ei ? {...x, quizWeeks:Array.from({length:totalWeeks},(_,i)=>i+1)} : x))}
                                    style={{ padding:'2px 7px', borderRadius:5, fontSize:10, cursor:'pointer', color:'var(--accent)', background:'transparent', border:'1px dashed var(--accent)' }}>All</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <Field label="Day">
                                    <select className="input" value={entry.quizDay}
                                      onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, quizDay:e.target.value} : x))}>
                                      {DAYS_OF_WEEK.map(d => <option key={d}>{d}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="Time">
                                    <input type="time" className="input" value={entry.quizTime}
                                      onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, quizTime:e.target.value} : x))} />
                                  </Field>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <Field label="Special rules">
                          <input className="input" value={entry.specialRules} placeholder="e.g. Must pass to pass unit"
                            onChange={e => setEntries(p => p.map((x,j) => j===ei ? {...x, specialRules:e.target.value} : x))} />
                        </Field>
                        <button className="btn btn-danger btn-sm mt-2"
                          onClick={() => setEntries(p => p.filter((_,j) => j !== ei))}>Remove</button>
                      </div>
                    ))}

                    <button className="btn btn-secondary btn-sm"
                      onClick={() => setEntries(p => [...p, blankAssess(`${uid}_${Date.now()}`)])}>
                      + Add assessment
                    </button>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Step 4: Weekly structure ── */}
          {step === 4 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 04 / 0{TOTAL}</div>
              <h1 className="font-serif text-4xl font-light mb-2" style={{ color: 'var(--text)' }}>Weekly structure</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
                Select what you do each week per unit. Tracker auto-builds your weekly completion tracking from this.
              </p>
              {/* Unit tabs */}
              <div className="flex gap-2 flex-wrap mb-5">
                {savedUnits.map((u, i) => (
                  <button key={u.id}
                    onClick={() => setWeeklyUnit(i)}
                    className="btn btn-sm"
                    style={{
                      background: weeklyUnit === i ? 'var(--accent-glow)' : 'var(--bg3)',
                      border: `1px solid ${weeklyUnit === i ? 'var(--accent)' : 'var(--border2)'}`,
                      color: weeklyUnit === i ? 'var(--accent)' : 'var(--text2)',
                    }}
                  >{u.code}</button>
                ))}
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>
                  Select weekly components for <strong style={{ color: 'var(--text)' }}>{savedUnits[weeklyUnit]?.code}</strong>:
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {WEEKLY_COMPONENTS.map(comp => (
                    <Pill key={comp} label={comp}
                      selected={(weeklySelections[weeklyUnit] ?? []).includes(comp)}
                      onClick={() => toggleWeeklyComp(weeklyUnit, comp)} />
                  ))}
                </div>
                <Field label="Custom items (comma-separated)">
                  <input className="input" value={weeklyCustom[weeklyUnit] ?? ''}
                    onChange={e => setWeeklyCustom(prev => ({ ...prev, [weeklyUnit]: e.target.value }))}
                    placeholder="e.g. Problem set, Recorded lecture" />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 5: Daily Habits ── */}
          {step === 5 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 05 / 0{TOTAL}</div>
              <h1 className="font-serif text-4xl font-light mb-2" style={{ color: 'var(--text)' }}>Your daily habits</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
                Pick the habits you want to track every day. You can always add, edit or remove them later.
              </p>

              <div className="rounded-xl p-4 mb-6" style={{ background:'var(--bg3)', border:'1px solid var(--accent)', borderColor:'var(--accent)' }}>
                <Field label="When do you want to start tracking? (This becomes Day 1 / Week 1)">
                  <input type="date" className="input" value={habitStartDate} onChange={e => setHabitStartDate(e.target.value)} />
                </Field>
                <p className="text-xs mt-1" style={{ color:'var(--text3)' }}>
                  Choose today to start right now, or a past date to backfill your data.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {SUGGESTED_HABITS.map(s => {
                  const on = selectedHabits.has(s.title)
                  return (
                    <button key={s.title}
                      onClick={() => setSelectedHabits(prev => {
                        const n = new Set(prev)
                        n.has(s.title) ? n.delete(s.title) : n.add(s.title)
                        return n
                      })}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: on ? s.colour + '22' : 'var(--bg3)',
                        border: `1.5px solid ${on ? s.colour : 'var(--border2)'}`,
                        color: on ? s.colour : 'var(--text2)',
                      }}>
                      <span style={{ fontSize:18 }}>{s.emoji}</span>
                      <span style={{ fontSize:13, fontWeight:500 }}>{s.title}</span>
                    </button>
                  )
                })}
              </div>

              {/* Custom habits */}
              <div className="rounded-xl p-4" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                <p className="text-xs mb-3" style={{ color:'var(--text3)' }}>Add a custom habit</p>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={customHabitInput}
                    onChange={e => setCustomHabitInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customHabitInput.trim()) {
                        setCustomHabits(prev => [...prev, { emoji:'🎯', title: customHabitInput.trim(), colour: HABIT_COLOURS[prev.length % HABIT_COLOURS.length] }])
                        setCustomHabitInput('')
                      }
                    }}
                    placeholder="e.g. Drink 2L water, No junk food..."
                  />
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    if (customHabitInput.trim()) {
                      setCustomHabits(prev => [...prev, { emoji:'🎯', title: customHabitInput.trim(), colour: HABIT_COLOURS[prev.length % HABIT_COLOURS.length] }])
                      setCustomHabitInput('')
                    }
                  }}>Add</button>
                </div>
                {customHabits.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {customHabits.map((h, i) => (
                      <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                        style={{ background: h.colour + '22', border:`1px solid ${h.colour}`, color: h.colour }}>
                        {h.emoji} {h.title}
                        <button onClick={() => setCustomHabits(prev => prev.filter((_,j)=>j!==i))} style={{ background:'none',border:'none',cursor:'pointer',color:'inherit',padding:0,marginLeft:2,fontSize:11 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs" style={{ color:'var(--text3)' }}>
                {selectedHabits.size + customHabits.length} habit{selectedHabits.size + customHabits.length !== 1 ? 's' : ''} selected
              </div>
            </div>
          )}

          {/* ── Step 6: Preferences ── */}
          {step === 6 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 06 / 0{TOTAL}</div>
              <h1 className="font-serif text-4xl font-light mb-2" style={{ color: 'var(--text)' }}>Study preferences</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text2)' }}>
                Helps calibrate the planner and recommendations to how you actually work.
              </p>
              <Field label="Weekly study hours target">
                <input type="number" className="input" value={weeklyHours} onChange={e => setWeeklyHours(parseInt(e.target.value) || 20)} min={1} max={80} />
              </Field>
              <Field label="Days you usually study">
                <div className="flex gap-2 flex-wrap mt-1">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                    <Pill key={d} label={d} selected={studyDays.includes(d)} onClick={() => toggleDay(d)} />
                  ))}
                </div>
              </Field>
              <Field label="Study style">
                <div className="flex gap-2 flex-wrap mt-1">
                  {([
                    { v: 'early', l: 'Get ahead' },
                    { v: 'steady', l: 'Spread evenly' },
                    { v: 'deadline', l: 'Deadline-driven' },
                    { v: 'exam', l: 'Exam-focused' },
                  ] as const).map(({ v, l }) => (
                    <Pill key={v} label={l} selected={studyStyle === v} onClick={() => setStudyStyle(v)} />
                  ))}
                </div>
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-10 py-5 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} style={{
              height: 8,
              width: i + 1 === step ? 24 : 8,
              borderRadius: 4,
              background: i + 1 <= step ? 'var(--accent)' : 'var(--bg4)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 1 && (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>← Back</button>
          )}
          <button className="btn btn-primary" onClick={nextStep}>
            {step === TOTAL ? 'Launch Tracker →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
