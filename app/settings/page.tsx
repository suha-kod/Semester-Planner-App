'use client'

import { useState } from 'react'
import { useStore, useActiveSemester } from '@/lib/store'
import { currentWeekNumber, fmtDate } from '@/lib/weeks'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Field, ConfirmDialog, Alert } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import type { AppData } from '@/types'
import { ACCENT_THEMES, type AccentTheme } from '@/lib/themes'

export default function SettingsPage() {
  const profile = useStore(s => s.profile)
  const updateProfile = useStore(s => s.updateProfile)
  const semester = useActiveSemester()
  const units = useStore(s => s.units)
  const assessments = useStore(s => s.assessments)
  const importData = useStore(s => s.importData)
  const resetAll = useStore(s => s.resetAll)
  const curWeek = currentWeekNumber(semester)

  const [showEditSem, setShowEditSem] = useState(false)
  const [showPatch, setShowPatch] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [patchText, setPatchText] = useState('')
  const [patchStatus, setPatchStatus] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  function exportJSON() {
    const state = useStore.getState()
    const data: AppData = { version:state.version, profile:state.profile, semesters:state.semesters, activeSemesterId:state.activeSemesterId, units:state.units, assessments:state.assessments, weeklyLogs:state.weeklyLogs, studyHours:state.studyHours, plannerTasks:state.plannerTasks, habits:state.habits, habitCheckIns:state.habitCheckIns, moodEntries:state.moodEntries }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tracker_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    toast('Backup exported ✓','success')
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target!.result as string) as AppData
        if (!data.semesters) { toast('Invalid backup file','error'); return }
        if (!confirm('Replace all current data with backup? This cannot be undone.')) return
        importData(data)
        toast('Data imported ✓','success')
      } catch { toast('Could not parse backup file','error') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function copyData() {
    const state = useStore.getState()
    const data: AppData = { version:state.version, profile:state.profile, semesters:state.semesters, activeSemesterId:state.activeSemesterId, units:state.units, assessments:state.assessments, weeklyLogs:state.weeklyLogs, studyHours:state.studyHours, plannerTasks:state.plannerTasks, habits:state.habits, habitCheckIns:state.habitCheckIns, moodEntries:state.moodEntries }
    try {
      await navigator.clipboard.writeText(JSON.stringify(data))
      setCopyStatus('✓ Copied!')
      toast('Data copied to clipboard','success')
      setTimeout(() => setCopyStatus(''), 3000)
    } catch {
      toast('Copy failed — use JSON export instead','error')
    }
  }

  async function pasteData() {
    try {
      const text = await navigator.clipboard.readText()
      applyPaste(text)
    } catch { showPasteModal() }
  }

  function applyPaste(text: string) {
    try {
      const data = JSON.parse(text.trim()) as AppData
      if (!data.semesters) { toast('Invalid Tracker data','error'); return }
      if (!confirm('Replace all data with pasted data?')) return
      importData(data)
      toast('Data loaded ✓','success')
    } catch { toast('Could not parse — make sure you copied from a Tracker file','error') }
  }

  function showPasteModal() {
    const text = prompt('Paste your Tracker data here:')
    if (text) applyPaste(text)
  }

  return (
    <div className="p-8 max-w-screen-xl">
      <div className="mb-7">
        <h1 className="font-serif text-4xl font-light" style={{ color:'var(--text)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color:'var(--text3)' }}>Preferences, backup, and semester management</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left column */}
        <div>
          {/* Semester info */}
          <div className="card mb-4">
            <div className="section-heading mb-3">Semester</div>
            {semester ? (
              <>
                <div className="font-medium mb-1" style={{color:'var(--text)'}}>{semester.name}</div>
                <div className="text-xs mb-0.5" style={{color:'var(--text3)'}}>{fmtDate(semester.startDate)} → {fmtDate(semester.endDate)}</div>
                <div className="text-xs mb-0.5" style={{color:'var(--text3)'}}>{semester.totalWeeks} teaching weeks · <strong style={{color:'var(--accent)'}}>Week {curWeek} now</strong></div>
                {(semester.breakWeeks?.length??0)>0 && <div className="text-xs" style={{color:'var(--text3)'}}>Break weeks: {semester.breakWeeks.map(w=>`Wk ${w}`).join(', ')}</div>}
                <div className="text-xs mt-1" style={{color:'var(--text3)'}}>{units.length} units · {assessments.length} assessments</div>
                <button className="btn btn-secondary btn-sm mt-3" onClick={()=>setShowEditSem(true)}>Edit semester</button>
              </>
            ) : <p className="text-sm" style={{color:'var(--text3)'}}>No semester configured.</p>}
          </div>

          {/* Profile */}
          <div className="card mb-4">
            <div className="section-heading mb-3">Profile</div>
            <Field label="Your name">
              <input className="input" value={profile.name} onChange={e=>updateProfile({name:e.target.value})} placeholder="Your name" />
            </Field>
            <Field label="Weekly study hours target">
              <input type="number" className="input" value={profile.weeklyHoursTarget} onChange={e=>updateProfile({weeklyHoursTarget:parseInt(e.target.value)||20})} min={1} max={80} />
            </Field>
            <Field label="Remind me X days before deadline">
              <input type="number" className="input" value={profile.remindDays} onChange={e=>updateProfile({remindDays:parseInt(e.target.value)||3})} min={1} max={14} />
            </Field>
            <Field label="Accent colour">
              <div className="flex flex-wrap gap-2 mt-1">
                {(Object.entries(ACCENT_THEMES) as [AccentTheme, typeof ACCENT_THEMES[AccentTheme]][]).map(([key, t]) => {
                  const active = (profile.accentColor || 'pink') === key
                  return (
                    <button
                      key={key}
                      title={t.label}
                      onClick={() => updateProfile({ accentColor: key })}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: t.swatch, cursor: 'pointer',
                        border: active ? `3px solid var(--text)` : '3px solid transparent',
                        outline: active ? `2px solid ${t.swatch}` : 'none',
                        outlineOffset: 2,
                        transition: 'all 0.15s',
                        transform: active ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  )
                })}
              </div>
            </Field>
          </div>

          {/* Danger */}
          <div className="card" style={{borderColor:'rgba(240,82,82,0.2)'}}>
            <div className="section-heading mb-2" style={{color:'var(--red)'}}>Danger zone</div>
            <p className="text-xs mb-3" style={{color:'var(--text3)'}}>Export a backup before resetting.</p>
            <button className="btn btn-danger btn-sm" onClick={()=>setShowReset(true)}>Reset all data</button>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Backup */}
          <div className="card mb-4">
            <div className="section-heading mb-3">Backup & restore</div>

            <div className="rounded-xl p-4 mb-3" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              <div className="text-xs font-semibold mb-1" style={{color:'var(--text2)'}}>① Copy data to clipboard</div>
              <div className="text-xs mb-3" style={{color:'var(--text3)'}}>Copy all your data, then paste it in any other Tracker instance.</div>
              <div className="flex items-center gap-3">
                <button className="btn btn-primary btn-sm" onClick={copyData}>Copy my data</button>
                {copyStatus && <span className="text-xs" style={{color:'var(--teal)'}}>{copyStatus}</span>}
              </div>
            </div>

            <div className="rounded-xl p-4 mb-3" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              <div className="text-xs font-semibold mb-1" style={{color:'var(--text2)'}}>② Paste data from clipboard</div>
              <div className="text-xs mb-3" style={{color:'var(--text3)'}}>Open a fresh Tracker, come here, and paste the data you copied.</div>
              <button className="btn btn-secondary btn-sm" onClick={pasteData}>Paste & load my data</button>
            </div>

            <div className="rounded-xl p-4" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              <div className="text-xs font-semibold mb-1" style={{color:'var(--text2)'}}>③ JSON file backup</div>
              <div className="text-xs mb-3" style={{color:'var(--text3)'}}>Save a .json file you can import back anytime.</div>
              <div className="flex gap-2">
                <button className="btn btn-secondary btn-sm" onClick={exportJSON}>⬇ Export .json</button>
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  ⬆ Import .json
                  <input type="file" accept=".json" style={{display:'none'}} onChange={handleImport} />
                </label>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="card">
            <div className="section-heading mb-2">About</div>
            <p className="text-sm" style={{color:'var(--text3)'}}>Tracker v1.0 — Phase 1</p>
            <p className="text-xs mt-1" style={{color:'var(--text3)'}}>Built with Next.js, Zustand, IndexedDB. Data stored locally in your browser.</p>
          </div>
        </div>
      </div>

      {/* Edit Semester Modal */}
      <EditSemesterModal open={showEditSem} onClose={()=>setShowEditSem(false)} />

      {/* Reset confirm */}
      <ConfirmDialog open={showReset} onCancel={()=>setShowReset(false)} onConfirm={()=>{ resetAll(); setShowReset(false); toast('All data reset','info') }} title="Reset all data" message="This will permanently delete all units, assessments, study logs, and planner tasks. Export a backup first. This cannot be undone." confirmLabel="Reset everything" danger />
    </div>
  )
}

function EditSemesterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const semester = useActiveSemester()
  const updateSemester = useStore(s => s.updateSemester)

  const [name, setName] = useState(semester?.name ?? '')
  const [startDate, setStartDate] = useState(semester?.startDate ?? '')
  const [endDate, setEndDate] = useState(semester?.endDate ?? '')
  const [totalWeeks, setTotalWeeks] = useState(semester?.totalWeeks ?? 13)
  const [breakWeeks, setBreakWeeks] = useState<number[]>(semester?.breakWeeks ?? [])

  function save() {
    updateSemester({ name, startDate, endDate, totalWeeks, breakWeeks })
    toast('Semester updated ✓','success')
    onClose()
  }

  const calWeeks = (totalWeeks ?? 13) + 4

  return (
    <Modal open={open} onClose={onClose} title="Edit semester" size="lg">
      <Field label="Semester name"><input className="input" value={name} onChange={e=>setName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date"><input type="date" className="input" value={startDate} onChange={e=>setStartDate(e.target.value)} /></Field>
        <Field label="End date"><input type="date" className="input" value={endDate} onChange={e=>setEndDate(e.target.value)} /></Field>
      </div>
      <Field label="Teaching weeks (excluding breaks)">
        <input type="number" className="input" value={totalWeeks} onChange={e=>setTotalWeeks(parseInt(e.target.value)||13)} min={1} max={30} />
      </Field>
      <Field label="Break / non-teaching calendar weeks" hint="Tick any weeks (from semester start) that are mid-sem break, public holidays, etc. These are skipped in the week counter.">
        <div className="flex flex-wrap gap-2 p-3 rounded-xl" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
          {Array.from({length:calWeeks},(_,i)=>{
            const w = i+1
            const checked = breakWeeks.includes(w)
            return (
              <label key={w} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{color:checked?'var(--accent)':'var(--text2)'}}>
                <input type="checkbox" checked={checked} onChange={()=>setBreakWeeks(prev=>checked?prev.filter(x=>x!==w):[...prev,w])} style={{accentColor:'var(--accent)'}} />
                Wk {w}
              </label>
            )
          })}
        </div>
      </Field>
      <ModalFooter>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save changes</button>
      </ModalFooter>
    </Modal>
  )
}
