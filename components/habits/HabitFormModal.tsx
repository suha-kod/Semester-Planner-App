'use client'

import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Field } from '@/components/ui/index'
import { toast } from '@/components/ui/Toast'
import type { Habit, HabitFrequency } from '@/types'
import { isoFromDate } from '@/lib/weeks'

const COLOURS = ['#3b82f6','#2dd4a0','#f5a623','#f05252','#60a5fa','#f472b6','#93c5fd','#34d399','#fb923c','#e879f9']
const EMOJIS  = ['📖','💡','✍️','🧠','🎯','📝','⏰','🔁','💪','🏃','📚','🖥️','📐','🔬','✅']

export function HabitFormModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Habit | null }) {
  const units = useStore(s => s.units)
  const { addHabit, updateHabit } = useStore()

  const [title, setTitle]       = useState(editing?.title ?? '')
  const [unitId, setUnitId]     = useState(editing?.unitId ?? '')
  const [frequency, setFreq]    = useState<HabitFrequency>(editing?.frequency ?? 'daily')
  const [target, setTarget]     = useState(editing?.targetCount?.toString() ?? '1')
  const [colour, setColour]     = useState(editing?.colour ?? COLOURS[0])
  const [emoji, setEmoji]       = useState(editing?.emoji ?? '📖')

  useMemo(() => {
    setTitle(editing?.title ?? '')
    setUnitId(editing?.unitId ?? '')
    setFreq(editing?.frequency ?? 'daily')
    setTarget(editing?.targetCount?.toString() ?? '1')
    setColour(editing?.colour ?? COLOURS[0])
    setEmoji(editing?.emoji ?? '📖')
  }, [editing])

  function save() {
    if (!title.trim()) { toast('Habit name required', 'error'); return }
    const data: Omit<Habit, 'id'> = {
      title: title.trim(),
      unitId: unitId || null,
      frequency,
      targetCount: parseInt(target) || 1,
      colour,
      emoji,
      active: true,
      createdAt: isoFromDate(new Date()),
    }
    if (editing) { updateHabit(editing.id, data); toast('Habit updated', 'success') }
    else { addHabit(data); toast('Habit added', 'success') }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit habit' : 'Add habit'} size="sm">
      <Field label="Habit name">
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Watch lecture" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Frequency">
          <select className="input" value={frequency} onChange={e => setFreq(e.target.value as HabitFrequency)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </Field>
        <Field label="Target per day">
          <input type="number" className="input" value={target} onChange={e => setTarget(e.target.value)} min={1} max={10} />
        </Field>
      </div>
      <Field label="Linked unit (optional)">
        <select className="input" value={unitId} onChange={e => setUnitId(e.target.value)}>
          <option value="">General</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
        </select>
      </Field>
      <Field label="Emoji">
        <div className="flex flex-wrap gap-2 mt-1">
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              className="w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all"
              style={{ background: emoji === e ? 'var(--accent-glow)' : 'var(--bg4)', border: `1px solid ${emoji === e ? 'var(--accent)' : 'var(--border2)'}` }}>
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Colour">
        <div className="flex flex-wrap gap-2 mt-1">
          {COLOURS.map(c => (
            <button key={c} onClick={() => setColour(c)}
              className="w-6 h-6 rounded-full transition-all"
              style={{ background: c, outline: colour === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
          ))}
        </div>
      </Field>
      <ModalFooter>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{editing ? 'Save changes' : 'Add habit'}</button>
      </ModalFooter>
    </Modal>
  )
}
