import { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { makeId } from '../utils/helpers'

const BLOCKS = ['JIC', 'CORR', 'MPC', 'ADHOC', 'EO']
const STATUSES = ['ACTV', 'PAUSE', 'IN WORK']

export default function ManualTaskForm({ onAdd, defaultBlock = 'ADHOC', zoneOptions = [], existingTasks = [] }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('new')
  const [seq, setSeq] = useState('')
  const [description, setDescription] = useState('')
  const [block, setBlock] = useState(defaultBlock)
  const [skills, setSkills] = useState('')
  const [trfx, setTrfx] = useState('')
  const [status, setStatus] = useState('ACTV')
  const [subTask, setSubTask] = useState('')
  const [registration, setRegistration] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const inputClass = 'border border-slate-300 rounded-md px-2 py-1.5 text-sm w-full'

  const fillFromExisting = (id) => {
    const t = existingTasks.find((x) => x.id === id)
    if (!t) return
    setSeq(t.seq && String(t.seq) !== '-' ? String(t.seq) : '')
    setDescription(t.description || '')
    setBlock(t.taskType || defaultBlock)
    setSkills(t.skills || '')
    setTrfx(t.taskBarcode || '')
    setStatus(t.mtxStatus || 'ACTV')
    setSubTask(t.workArea || '')
    setRegistration(t.registration || '')
  }

  const openForm = () => {
    setSource('new')
    setSeq('')
    setDescription('')
    setBlock(defaultBlock)
    setSkills('')
    setTrfx('')
    setStatus('ACTV')
    setSubTask('')
    setRegistration('')
    setNote('')
    setError('')
    setOpen(true)
  }

  const submit = () => {
    const desc = description.trim()
    if (!desc) {
      setError('La tâche (description) est obligatoire.')
      return
    }
    onAdd({
      id: makeId('task'),
      seq: seq.trim() || undefined,
      description: desc,
      taskType: block,
      skills: skills.trim() || undefined,
      taskBarcode: trfx.trim() || undefined,
      mtxStatus: status,
      workArea: subTask.trim() || undefined,
      registration: registration.trim() || undefined,
      note: note.trim() || undefined,
    })
    setSeq('')
    setDescription('')
    setSkills('')
    setTrfx('')
    setStatus('ACTV')
    setSubTask('')
    setRegistration('')
    setNote('')
    setError('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={openForm}
        className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 border border-dashed border-sky-300 hover:bg-sky-50 rounded-md px-3 py-1.5"
        title="Ajouter une ligne manuellement"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
      </button>
    )
  }

  return (
    <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setSource('new')
            setSeq('')
            setDescription('')
            setSkills('')
            setTrfx('')
            setStatus('ACTV')
            setSubTask('')
            setRegistration('')
          }}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
            source === 'new'
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          + Nouvelle tâche
        </button>
        <button
          onClick={() => setSource('existing')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
            source === 'existing'
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          ↳ Reprendre une tâche existante
        </button>
      </div>

      {source === 'existing' && (
        <div>
          <label className="text-xs font-medium text-slate-600">
            Tâche existante (ses informations seront reprises, vous pouvez les modifier)
          </label>
          <select
            className={`${inputClass} mt-1`}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) fillFromExisting(e.target.value)
            }}
          >
            <option value="">— Choisir une tâche —</option>
            {existingTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.seq !== undefined && t.seq !== '' ? `#${t.seq} · ` : ''}
                {t.description}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-600">
          N° de ligne
          <input
            value={seq}
            onChange={(e) => setSeq(e.target.value)}
            placeholder="Ex : 72"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-slate-600 lg:col-span-2">
          Tâche
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description de la tâche"
            className={`${inputClass} mt-1`}
            autoFocus={source === 'new'}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Bloc
          <select
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            {BLOCKS.map((b) => (
              <option key={b} value={b}>{b === 'CORR' ? 'Found Fault' : b}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Skills
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Ex : CABB1B2"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          TRFX
          <input
            value={trfx}
            onChange={(e) => setTrfx(e.target.value)}
            placeholder="Ex : TRFX900…"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Statut
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Sous-tâche
          <input
            value={subTask}
            onChange={(e) => setSubTask(e.target.value)}
            placeholder={block === 'CORR' ? 'Found Fault' : block}
            list="manual-task-subtasks"
            className={`${inputClass} mt-1`}
            title="Sous-tâche / zone de la ligne (suggestions des lignes existantes)"
          />
          <datalist id="manual-task-subtasks">
            {zoneOptions.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Appareil
          <input
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            placeholder="Ex : F-GKXT"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-slate-600 sm:col-span-2">
          Note (ex : stock 0)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Précision attachée à cette ligne…"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 italic">
          Équipe : <strong>non assignée</strong> — à affecter dans la page Affectation.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setError('')
              setOpen(false)
            }}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-xs"
          >
            <X className="h-3.5 w-3.5" /> Annuler
          </button>
          <button
            onClick={submit}
            className="flex items-center gap-1.5 bg-sky-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-sky-700"
          >
            <Check className="h-3.5 w-3.5" /> Ajouter la ligne
          </button>
        </div>
      </div>
    </div>
  )
}