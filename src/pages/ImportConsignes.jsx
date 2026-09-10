import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  parseConsignesWorkbook,
} from '../lib/consignesExcel'
import { buildProfileData, aircraftProfileLabel } from '../lib/profileBuilder'
import * as profileStore from '../lib/profileStore'
import { useApp } from '../context/AppContext'
import {
  Upload,
  FileSpreadsheet,
  Users,
  Plane,
  AlertTriangle,
  Rocket,
  CheckCircle2,
  XCircle,
  Pencil,
  RotateCcw,
} from 'lucide-react'

const SHIFT_COLORS = {
  matin: '#10b981',
  soir: '#6366f1',
  nuit: '#3b82f6',
}

export default function ImportConsignes() {
  const { activeProfile } = useApp()
  const fileInputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedShift, setSelectedShift] = useState('matin')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])
  const [overrides, setOverrides] = useState({})
  const [editRow, setEditRow] = useState(null)
  const [editText, setEditText] = useState('')

  const overrideKey = (immat) => `${selectedDay}::${immat}::${selectedShift}`

  const effectiveTasks = (immat) => {
    const ov = overrides[overrideKey(immat)]
    if (Array.isArray(ov)) return ov
    const block = sheet?.blocks.find((b) => b.immat === immat)
    return block?.shifts[selectedShift] || []
  }

  const handleFile = (file) => {
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const results = parseConsignesWorkbook(workbook)
        setReport(results)
        const days = Object.keys(results)
        setSelectedDay(days[0] || '')
        setSelectedShift('matin')
      } catch (err) {
        setError(`Erreur lors de la lecture : ${err.message}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const days = report ? Object.keys(report) : []
  const sheet = report && selectedDay ? report[selectedDay] : null

  // Avions éligibles pour le jour × shift sélectionné : consignes remplies
  const eligible = useMemo(() => {
    if (!sheet) return []
    return sheet.blocks
      .filter((b) => (b.shifts[selectedShift] || []).length > 0)
      .map((b) => b.immat)
  }, [sheet, selectedShift])

  // Avions présents à l'effectif de ce shift mais sans consignes ce jour-là
  const skippedBydayshift = useMemo(() => {
    if (!sheet) return []
    const haveTasks = new Set(eligible)
    const shiftEff = sheet.effectif.find((s) => s.shift === selectedShift)
    const withEffectif = new Set(
      (shiftEff?.members || []).flatMap((m) => m.aircrafts)
    )
    return [...withEffectif].filter((immat) => !haveTasks.has(immat)).sort()
  }, [sheet, eligible, selectedShift])

  const aircraftInfoForScope = (immat) => {
    const shiftEff = sheet.effectif.find((s) => s.shift === selectedShift)
    const members = (shiftEff?.members || [])
      .filter((m) => m.aircrafts.includes(immat))
      .map((m) => m.name)
    return {
      immat,
      totalTasks: effectiveTasks(immat).length,
      days: {
        [selectedDay]: {
          [selectedShift]: [...new Set(members)],
          consignes: { [selectedShift]: effectiveTasks(immat) },
        },
      },
    }
  }

  const totalMembers = report
    ? Object.values(report).reduce(
        (acc, s) => acc + s.effectif.reduce((a, sh) => a + sh.members.length, 0),
        0
      )
    : 0
  const totalBlocks = report
    ? Object.values(report).reduce((acc, s) => acc + s.blocks.length, 0)
    : 0

  const selectClass =
    'border border-slate-300 rounded-md px-3 py-2 text-sm bg-white'

  const runCreation = async () => {
    if (!eligible.length || !activeProfile?.code || !sheet) return
    setRunning(true)
    setResults([])
    const out = []
    const created = []
    const updated = []

    for (const immat of eligible) {
      const aircraftInfo = aircraftInfoForScope(immat)
      try {
        const lookup = await profileStore.getProfile(immat)
        let rev = lookup?.rev ?? 0
        let createdNow = false
        if (!lookup) {
          const res = await profileStore.adminCreateProfile(
            activeProfile.code,
            immat,
            aircraftProfileLabel(immat),
            immat
          )
          if (res?.error === 'code_exists') {
            const again = await profileStore.getProfile(immat)
            rev = again?.rev ?? 0
          } else if (res?.error) {
            out.push({ immat, ok: false, error: res.error })
            continue
          } else {
            createdNow = true
          }
        }

        const current = createdNow ? {} : lookup?.data || {}
        const scope = { day: selectedDay, shift: selectedShift }
        const merged = buildProfileData(current, aircraftInfo, scope)
        let saved = await profileStore.saveProfileData(immat, merged, rev, false)
        if (saved?.error === 'conflict') {
          const fresh = await profileStore.getProfile(immat)
          const merged2 = buildProfileData(fresh?.data || {}, aircraftInfo, scope)
          saved = await profileStore.saveProfileData(immat, merged2, fresh?.rev ?? 0, false)
          rev = fresh?.rev ?? 0
        }
        if (saved?.error) {
          out.push({ immat, ok: false, error: saved.error })
          continue
        }
        if (createdNow) created.push(immat)
        else updated.push(immat)
        out.push({ immat, ok: true, created: createdNow })
      } catch (err) {
        out.push({ immat, ok: false, error: err?.message || 'erreur réseau' })
      }
      setResults([...out])
    }

    setResults([
      ...out,
      {
        summary: `Terminé : ${created.length} profil(s) créé(s), ${updated.length} mis à jour, ${
          out.filter((r) => !r.ok).length
        } échec(s) — ${selectedDay} ${selectedShift.charAt(0).toUpperCase() + selectedShift.slice(1)}.`,
      },
    ])
    setRunning(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Import consignes (rapport)</h1>
        <p className="text-slate-600 mt-1">
          Phase 1 — analyse du fichier CONSIGNES S37 : choisissez le jour et le shift à consulter.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      )}

      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-white hover:border-sky-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsm,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            if (e.target.files[0]) handleFile(e.target.files[0])
            e.target.value = ''
          }}
        />
        <Upload className="h-10 w-10 mx-auto text-slate-400" />
        <p className="mt-3 font-medium text-slate-700">
          Déposez le fichier « CONSIGNES S37.xlsm » ici
        </p>
        <p className="text-sm text-slate-500 mt-1">Formats : .xlsm, .xlsx, .xls</p>
        {fileName && (
          <p className="mt-3 inline-flex items-center gap-2 bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-sm">
            <FileSpreadsheet className="h-4 w-4" /> {fileName}
          </p>
        )}
      </div>

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{days.length}</div>
              <div className="text-sm text-slate-500">Feuilles jours lues</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{totalMembers}</div>
              <div className="text-sm text-slate-500">Membres affectés (tous shifts)</div>
            </div>
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{totalBlocks}</div>
              <div className="text-sm text-slate-500">Blocs de charge (avions)</div>
            </div>
          </div>

          {/* Phase 2 — création des profils */}
          {report && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Rocket className="h-5 w-5 text-sky-500" /> Création des profils avion
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Crée ou met à jour les profils des avions ayant des consignes{' '}
                <strong>
                  {selectedDay} — {selectedShift.charAt(0).toUpperCase() + selectedShift.slice(1)}
                </strong>
                . L'effectif de ce jour × shift est ajouté aux <strong>membres pré-enregistrés</strong>{' '}
                du profil (aucune équipe n'est créée : le leader monte ses équipes dans la page
                Équipes), et la consigne du jour est insérée dans le Bloc-notes (note [C] remplacée
                si déjà présente). Tâches, équipes et affectations existantes sont conservées.
              </p>
              {skippedBydayshift.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  {skippedBydayshift.length} avion(s) à l'effectif de ce shift mais sans consigne
                  ce jour : {skippedBydayshift.join(', ')}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={runCreation}
                  disabled={running || eligible.length === 0}
                  className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {running
                    ? 'Création en cours…'
                    : `Créer / mettre à jour les ${eligible.length} profils (${selectedDay} ${selectedShift.charAt(0).toUpperCase() + selectedShift.slice(1)})`}
                </button>
                {running && <span className="text-sm text-slate-500">ne fermez pas l'onglet</span>}
              </div>
              {results.length > 0 && (
                <div className="mt-4 space-y-1">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`text-xs flex items-center gap-2 ${
                        r.summary ? 'font-semibold text-slate-700 mt-2' : r.ok ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {r.summary ? (
                        r.summary
                      ) : r.ok ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="font-mono font-bold">{r.immat}</span>
                          {r.created ? ' — profil créé et chargé' : ' — profil mis à jour'}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="font-mono font-bold">{r.immat}</span> — {r.error}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Choix jour + shift */}
          <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-slate-700">
              Jour
              <select
                className={`${selectClass} ml-2`}
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {report[d].date ? ` (${report[d].date})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Shift
              <select
                className={`${selectClass} ml-2`}
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
              >
                {['matin', 'soir', 'nuit'].map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            {sheet?.date && (
              <span className="text-sm text-slate-500">
                {selectedDay} · {sheet.date}
              </span>
            )}
          </div>

          {/* Aperçu jour + shift choisis */}
          {sheet && (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div className="bg-white rounded-xl shadow p-4">
                <h2 className="font-semibold flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-sky-500" /> Effectif {selectedDay}
                </h2>
                <div className="grid gap-3">
                  {['matin', 'soir', 'nuit'].map((s) => {
                    const sh = sheet.effectif.find((x) => x.shift === s)
                    const active = selectedShift === s
                    return (
                      <div
                        key={s}
                        className={`border rounded-lg overflow-hidden ${
                          active ? 'ring-2 ring-sky-400' : 'opacity-70'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedShift(s)}
                          className={`w-full px-3 py-1.5 text-white text-xs font-bold flex items-center justify-between ${
                            active ? '' : 'hover:brightness-110'
                          }`}
                          style={{ backgroundColor: SHIFT_COLORS[s] || '#64748b' }}
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)} ({sh?.members.length || 0})
                        </button>
                        {active && (
                          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                            {sh?.members.map((m, i) => (
                              <li key={i} className="px-3 py-1.5 text-xs flex justify-between gap-2">
                                <span className="truncate">{m.name}</span>
                                <span className="font-mono text-sky-700 shrink-0">
                                  {m.aircrafts.join(', ')}
                                </span>
                              </li>
                            ))}
                            {(!sh || sh.members.length === 0) && (
                              <li className="px-3 py-2 text-xs text-slate-400 italic">
                                Aucun membre pour ce shift.
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-4 sm:p-6">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Plane className="h-5 w-5 text-sky-500" />
                  Charge {selectedDay} — {selectedShift.charAt(0).toUpperCase() + selectedShift.slice(1)} (
                  {sheet.blocks.length} avions)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-left bg-slate-50">
                        <th className="px-3 py-2 font-semibold text-slate-700">Avion</th>
                        <th className="px-3 py-2 font-semibold text-slate-700">Type de visite</th>
                        <th className="px-3 py-2 font-semibold text-slate-700">Heure</th>
                        <th className="px-3 py-2 font-semibold text-slate-700">
                          Tâches{' '}
                          {selectedShift.charAt(0).toUpperCase() + selectedShift.slice(1)}{' '}
                          <span className="font-normal text-slate-400">(crayon = modifier)</span>
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700">Autres shifts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.blocks.map((b, i) => {
                        const tasks = effectiveTasks(b.immat)
                        const overridden = Array.isArray(overrides[overrideKey(b.immat)])
                        const others = ['matin', 'soir', 'nuit']
                          .filter((s) => s !== selectedShift)
                          .filter((s) => {
                            const ovKey = `${selectedDay}::${b.immat}::${s}`
                            const ov = overrides[ovKey]
                            return (Array.isArray(ov) ? ov : b.shifts[s] || []).length > 0
                          })
                        const editing = editRow === b.immat
                        return (
                          <tr key={i} className="border-b hover:bg-slate-50 align-top">
                            <td className="px-3 py-2 font-mono font-bold text-sky-700 whitespace-nowrap">
                              {b.immat}
                            </td>
                            <td className="px-3 py-2">{b.typeVisite || '—'}</td>
                            <td className="px-3 py-2">{b.heureEntree || '—'}</td>
                            <td className="px-3 py-2 max-w-[340px]">
                              {editing ? (
                                <div className="flex flex-col gap-1">
                                  <textarea
                                    autoFocus
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={Math.max(3, Math.min(tasks.length + 1, 12))}
                                    className="border border-slate-300 rounded-md px-2 py-1 text-xs w-full"
                                    placeholder="Une tâche par ligne"
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => {
                                        setOverrides((prev) => ({
                                          ...prev,
                                          [overrideKey(b.immat)]: editText
                                            .split('\n')
                                            .map((t) => t.trim())
                                            .filter(Boolean),
                                        }))
                                        setEditRow(null)
                                      }}
                                      className="text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded px-2 py-1"
                                    >
                                      OK
                                    </button>
                                    <button
                                      onClick={() => setEditRow(null)}
                                      className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-1">
                                  <ul className="space-y-0.5 flex-1 min-w-0">
                                    {tasks.length === 0 ? (
                                      <li className="text-xs text-slate-400 italic">aucune tâche</li>
                                    ) : (
                                      tasks.map((t, j) => (
                                        <li key={j} className="text-xs text-slate-600 leading-snug">
                                          · {t}
                                        </li>
                                      ))
                                    )}
                                  </ul>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    {overridden && (
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-1 py-0.5">
                                        modifié
                                      </span>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditRow(b.immat)
                                        setEditText(tasks.join('\n'))
                                      }}
                                      className="text-slate-400 hover:text-sky-600"
                                      title={`Modifier les consignes de ${b.immat}`}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    {overridden && (
                                      <button
                                        onClick={() =>
                                          setOverrides((prev) => {
                                            const next = { ...prev }
                                            delete next[overrideKey(b.immat)]
                                            return next
                                          })
                                        }
                                        className="text-slate-400 hover:text-red-600"
                                        title="Revenir au fichier"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {others.map((s) => (
                                  <span
                                    key={s}
                                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                                    style={{ backgroundColor: SHIFT_COLORS[s] || '#64748b' }}
                                  >
                                    {s} : {(() => {
                                      const ovKey = `${selectedDay}::${b.immat}::${s}`
                                      const ov = overrides[ovKey]
                                      return (Array.isArray(ov) ? ov : b.shifts[s] || []).length
                                    })()}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {sheet.blocks.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-sm">
                            Aucun bloc de charge détecté ce jour.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}