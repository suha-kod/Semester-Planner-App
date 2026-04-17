'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Field } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import type { Assessment, AssessmentType, AssessmentStatus } from '@/types'

const TYPES: AssessmentType[] = ['assignment','quiz','exam','midsem','lab','presentation','group','participation','hurdle','other']
const STATUSES: AssessmentStatus[] = ['not-started','planned','in-progress','submitted','graded','overdue','complete']

export function AssessmentFormModal({ open, onClose, editing, defaultUnitId = '' }: { open: boolean; onClose: () => void; editing: Assessment | null; defaultUnitId?: string }) {
  const units = useStore(s => s.units)
  const { addAssessment, updateAssessment } = useStore()

  const [name, setName]             = useState(editing?.name ?? '')
  const [unitId, setUnitId]         = useState(editing?.unitId ?? defaultUnitId)
  const [type, setType]             = useState<AssessmentType>(editing?.type ?? 'assignment')
  const [weight, setWeight]         = useState(editing?.weight?.toString() ?? '')
  const [status, setStatus]         = useState<AssessmentStatus>(editing?.status ?? 'not-started')
  const [dueDate, setDueDate]       = useState(editing?.dueDate ?? '')
  const [personalDue, setPersonalDue] = useState(editing?.personalDueDate ?? '')
  const [mark, setMark]             = useState(editing?.mark?.toString() ?? '')
  const [maxMark, setMaxMark]       = useState(editing?.maxMark?.toString() ?? '100')
  const [rules, setRules]           = useState(editing?.specialRules ?? '')
  const [notes, setNotes]           = useState(editing?.notes ?? '')
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || editing) return
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItems = items.filter(i => i.type.startsWith('image/'))
      if (!imageItems.length) return
      e.preventDefault()
      const files = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[]
      extractFromImages(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open, editing])

  useMemo(() => {
    setName(editing?.name ?? '')
    setUnitId(editing?.unitId ?? defaultUnitId)
    setType(editing?.type ?? 'assignment')
    setWeight(editing?.weight?.toString() ?? '')
    setStatus(editing?.status ?? 'not-started')
    setDueDate(editing?.dueDate ?? '')
    setPersonalDue(editing?.personalDueDate ?? '')
    setMark(editing?.mark?.toString() ?? '')
    setMaxMark(editing?.maxMark?.toString() ?? '100')
    setRules(editing?.specialRules ?? '')
    setNotes(editing?.notes ?? '')
  }, [editing, defaultUnitId])

  async function extractFromImages(files: File[]) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) { toast('Please upload an image file (PNG, JPG, etc.)', 'error'); return }
    setExtracting(true)
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
      const extracted = json.assessments
      if (!extracted?.length) { toast('No assessments found in image', 'info'); return }
      const first = extracted[0]
      setName(first.name ?? '')
      setType(first.type ?? 'assignment')
      setWeight(first.weight?.toString() ?? '')
      setDueDate(first.dueDate ?? '')
      setMaxMark(first.maxMark?.toString() ?? '100')
      setRules(first.specialRules ?? '')
      if (extracted.length > 1) {
        extracted.slice(1).forEach((a: any) => {
          addAssessment({ name: a.name, unitId, type: a.type ?? 'assignment', weight: a.weight ?? 0, status: 'not-started', dueDate: a.dueDate ?? null, personalDueDate: null, mark: null, maxMark: a.maxMark ?? 100, specialRules: a.specialRules ?? '', notes: '' })
        })
        toast(`Filled form with "${first.name}" + added ${extracted.length - 1} more`, 'success')
      } else {
        toast(`Extracted "${first.name}" from image`, 'success')
      }
    } catch (e: any) {
      toast(e.message || 'Extraction failed', 'error')
    } finally {
      setExtracting(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) extractFromImages(files)
    e.target.value = ''
  }

  function save() {
    if (!name.trim()) { toast('Name is required', 'error'); return }
    const data: Omit<Assessment,'id'> = {
      name: name.trim(), unitId, type, weight: parseFloat(weight)||0, status,
      dueDate: dueDate||null, personalDueDate: personalDue||null,
      mark: mark!==''?parseFloat(mark):null, maxMark: parseFloat(maxMark)||100,
      specialRules: rules.trim(), notes: notes.trim(),
    }
    if (editing) { updateAssessment(editing.id, data); toast('Assessment updated','success') }
    else { addAssessment(data); toast('Assessment added','success') }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing?'Edit assessment':'Add assessment'} size="lg">
      {!editing && (
        <div className="rounded-xl p-4 mb-4 flex items-center justify-between gap-3" style={{ background:'var(--bg3)', border:'1px dashed var(--border2)' }}>
          <div>
            <div className="text-sm font-medium" style={{ color:'var(--text)' }}>Extract from outline</div>
            <div className="text-xs mt-0.5" style={{ color:'var(--text3)' }}>Upload a screenshot or paste one (Ctrl+V / Cmd+V) to auto-fill fields</div>
          </div>
          <div className="flex items-center gap-2">
            {extracting && <span className="text-xs" style={{ color:'var(--accent)' }}>Extracting...</span>}
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={handleFileChange} />
            <button className="btn btn-secondary btn-sm" onClick={()=>fileRef.current?.click()} disabled={extracting}>Upload image</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Assessment name"><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Assignment 1" /></Field>
        <Field label="Unit">
          <select className="input" value={unitId} onChange={e=>setUnitId(e.target.value)}>
            <option value="">— no unit —</option>
            {units.map(u=><option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Type">
          <select className="input" value={type} onChange={e=>setType(e.target.value as AssessmentType)}>
            {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Weight (%)"><input type="number" className="input" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="30" min={0} max={100} /></Field>
        <Field label="Status">
          <select className="input" value={status} onChange={e=>setStatus(e.target.value as AssessmentStatus)}>
            {STATUSES.map(s=><option key={s} value={s}>{s.replace('-',' ')}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Official due date"><input type="date" className="input" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></Field>
        <Field label="Personal target date"><input type="date" className="input" value={personalDue} onChange={e=>setPersonalDue(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mark received"><input type="number" className="input" value={mark} onChange={e=>setMark(e.target.value)} placeholder="Leave blank if unknown" min={0} /></Field>
        <Field label="Out of"><input type="number" className="input" value={maxMark} onChange={e=>setMaxMark(e.target.value)} min={1} /></Field>
      </div>
      <Field label="Special rules"><input className="input" value={rules} onChange={e=>setRules(e.target.value)} placeholder="e.g. Best 8 of 12 counted. Must pass to pass unit." /></Field>
      <Field label="Notes"><textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional notes, feedback..." /></Field>
      <ModalFooter>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{editing?'Save changes':'Add assessment'}</button>
      </ModalFooter>
    </Modal>
  )
}
