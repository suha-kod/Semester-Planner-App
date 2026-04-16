'use client'

import { useState, useRef } from 'react'
import { useStore } from '@/lib/store'
import { toast } from '../ui/Toast'
import { Field, Pill } from '../ui/index'
import type { Unit } from '@/types'

const UNIT_COLOURS = ['#7c5cfc','#2dd4a0','#f5a623','#f05252','#60a5fa','#f472b6','#a78bfa','#34d399']

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
  const TOTAL = 4

  // Step 1 — profile + semester
  const [name, setName] = useState('')
  const [semName, setSemName] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 4); return d.toISOString().split('T')[0]
  })
  const [totalWeeks, setTotalWeeks] = useState(13)
  const [gradeGoal, setGradeGoal] = useState('')

  // Step 2 — units
  const [unitForms, setUnitForms] = useState([blankUnit(0)])

  // Step 3 — weekly structure per unit
  const [savedUnits, setSavedUnits] = useState<Unit[]>([])
  const [weeklyUnit, setWeeklyUnit] = useState(0)
  const [weeklySelections, setWeeklySelections] = useState<Record<number, string[]>>({})
  const [weeklyCustom, setWeeklyCustom] = useState<Record<number, string>>({})

  // Step 4 — preferences
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
        // Delete any previously-saved placeholder units (e.g. if user went Back and edited)
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
        const initSel: Record<number, string[]> = {}
        added.forEach((_, i) => { initSel[i] = [] })
        setWeeklySelections(initSel)
        setStep(3)
        return
      }

      if (step === 3) {
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
        setStep(4)
        return
      }

      if (step === 4) {
        updateProfile({ name: name.trim(), studyDays, weeklyHoursTarget: weeklyHours, studyStyle })
        updateSemester({ name: semName.trim(), startDate, endDate, totalWeeks, gradeGoal: gradeGoal as any })
        const { addAssessment } = useStore.getState()
        savedUnits.forEach((unit, i) => {
          const extracts = extractedAssessments[i] ?? []
          extracts.forEach((a: any) => {
            addAssessment({ name: a.name, unitId: unit.id, type: a.type ?? 'assignment', weight: a.weight ?? 0, status: 'not-started', dueDate: a.dueDate ?? null, personalDueDate: null, mark: null, maxMark: a.maxMark ?? 100, specialRules: a.specialRules ?? '', notes: '' })
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
              <p className="text-sm mb-8" style={{ color: 'var(--text2)' }}>
                Let's set up your semester in about 5 minutes. Everything can be edited later.
              </p>
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
                <Field label="Teaching weeks">
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

          {/* ── Step 3: Weekly structure ── */}
          {step === 3 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 03 / 0{TOTAL}</div>
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

          {/* ── Step 4: Preferences ── */}
          {step === 4 && (
            <div className="fade-in">
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--accent)' }}>STEP 04 / 0{TOTAL}</div>
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
