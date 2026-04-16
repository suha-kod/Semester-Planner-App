'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Modal, ModalFooter } from '../ui/Modal'
import { Field } from '../ui/index'
import { toast } from '../ui/Toast'
import { todayISO } from '@/lib/weeks'

export function StudyHoursModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useStore(s => s.units)
  const addStudyHours = useStore(s => s.addStudyHours)

  const [date, setDate] = useState(todayISO)
  const [hours, setHours] = useState('')
  const [unitId, setUnitId] = useState('')
  const [notes, setNotes] = useState('')

  function handleSave() {
    const h = parseFloat(hours)
    if (!date || isNaN(h) || h <= 0) { toast('Enter a valid date and hours', 'error'); return }
    addStudyHours({ date, hours: h, unitId: unitId || null, notes })
    toast(`${h}h logged ✓`, 'success')
    setHours(''); setNotes(''); setUnitId('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Log study hours" size="sm">
      <Field label="Date">
        <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="Hours studied">
        <input type="number" className="input" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 2.5" min={0} max={24} step={0.5} />
      </Field>
      <Field label="Tag to unit (optional)">
        <select className="input" value={unitId} onChange={e => setUnitId(e.target.value)}>
          <option value="">General study</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
        </select>
      </Field>
      <Field label="Notes (optional)">
        <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What did you work on?" />
      </Field>
      <ModalFooter>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Log hours</button>
      </ModalFooter>
    </Modal>
  )
}
