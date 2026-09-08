import { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { makeId } from '../utils/helpers'

const BLOCKS = ['JIC', 'CORR', 'MPC', 'ADHOC', 'EO']

export default function ManualTaskForm({ onAdd, defaultBlock = 'ADHOC' }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [block, setBlock] = useState(defaultBlock)
  const [zone, setZone] = useState('')
  const [hours, setHours] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const desc = description.trim()
    if (!desc) {
      setError('La description est obligatoire.')
      return
    }
    onAdd({
      id: makeId('task'),
      seq: '',
      description: desc,
      taskType: block,
      workArea: zone.trim() || undefined,
      scheduledHours: hours.trim() || undefined,
      mtxStatus: 'ACTV',
    })
    setDescription('')
    setZone('')
    setHours('')
    setError('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 border border-dashed border-sky-300 hover:bg-sky-50 rounded-md px-3 py-1.5"
        title="Ajouter une ligne manuellement"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
      </button>
    )
  }

  return (
    <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description de la tâche…"
          className="flex-1 min-w-[200px] border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          autoFocus
        />
        <select
          value={block}
          onChange={(e) => setBlock(e.target.value)}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          title="Bloc"
        >
          {BLOCKS.map((b) => (
            <option key={b} value={b}>{b === 'CORR' ? 'Found Fault' : b}</option>
          ))}
        </select>
        <input
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          placeholder="Zone"
          className="w-32 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
        />
        <input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Heures"
          className="w-20 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          className="flex items-center gap-1.5 bg-sky-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-sky-700"
        >
          <Check className="h-3.5 w-3.5" /> Ajouter la ligne
        </button>
        <button
          onClick={() => {
            setError('')
            setOpen(false)
          }}
          className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-xs"
        >
          <X className="h-3.5 w-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}