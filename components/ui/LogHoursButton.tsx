'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { isoFromDate } from '@/lib/weeks'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'

export function LogHoursButton() {
  const studyHours = useStore(s => s.studyHours)
  const units = useStore(s => s.units)
  const { addStudyHours, deleteStudyHours } = useStore()
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState('')
  const [unitId, setUnitId] = useState('')
  const todayISO = isoFromDate(new Date())

  const todayEntries = studyHours.filter(h => h.date === todayISO)
  const todayTotal = todayEntries.reduce((s, h) => s + h.hours, 0)

  function openModal() { setHours(''); setUnitId(''); setOpen(true) }

  function save() {
    const h = parseFloat(hours)
    if (!h || h <= 0) { toast('Enter a valid number of hours', 'error'); return }
    addStudyHours({ date: todayISO, hours: h, unitId: unitId || null, notes: '' })
    toast(`+${h}h logged`, 'success')
    setHours('')
    setUnitId('')
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={openModal}>
        + Log hours{todayTotal > 0 && <span style={{ marginLeft:4, color:'var(--accent)', fontWeight:700 }}>{todayTotal.toFixed(1)}h today</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Log study hours" size="sm">
        <div className="text-xs mb-4" style={{ color:'var(--text3)' }}>
          Today — {new Date().toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' })}
        </div>
        {todayEntries.length > 0 && (
          <div className="mb-4 rounded-xl p-3" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color:'var(--text2)' }}>Logged today</div>
            {todayEntries.map(e => {
              const u = units.find(u => u.id === e.unitId)
              return (
                <div key={e.id} className="flex items-center justify-between py-1" style={{ borderBottom:'1px solid var(--border)' }}>
                  <span className="text-sm font-mono" style={{ color:'var(--accent)' }}>{e.hours}h</span>
                  <span className="text-xs" style={{ color:'var(--text3)' }}>{u ? u.code : 'General'}</span>
                  <button onClick={() => { deleteStudyHours(e.id); toast('Removed', 'info') }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:14, padding:'0 4px' }}>×</button>
                </div>
              )
            })}
            <div className="text-xs font-mono mt-2 text-right" style={{ color:'var(--text)' }}>
              Total: <strong style={{ color:'var(--accent)' }}>{todayTotal.toFixed(1)}h</strong>
            </div>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <div className="text-xs mb-1" style={{ color:'var(--text3)' }}>Hours</div>
            <input type="number" className="input" value={hours} onChange={e => setHours(e.target.value)}
              placeholder="e.g. 1.5" min={0.25} step={0.25} autoFocus
              onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div className="flex-1">
            <div className="text-xs mb-1" style={{ color:'var(--text3)' }}>Unit (optional)</div>
            <select className="input" value={unitId} onChange={e => setUnitId(e.target.value)}>
              <option value="">General</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={save}>Add</button>
        </div>
        <ModalFooter>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Done</button>
        </ModalFooter>
      </Modal>
    </>
  )
}
