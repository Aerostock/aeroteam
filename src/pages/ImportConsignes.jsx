import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  parseConsignesWorkbook,
  summarizeAircrafts,
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
  const [aircrafts, setAircrafts] = useState(null)
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedShift, setSelectedShift] = useState('matin')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([])

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
        setAircrafts(summarizeAircrafts(results))
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
    if (!aircrafts || !activeProfile?.code) return
    setRunning(true)
    setResults([])
    const out = []
    const created = []
    const updated = []

    for (const aircraft of aircrafts) {
      const immat = aircraft.immat
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
            // quelqu'un l'a créé entre-temps (rare)
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
        const merged = buildProfileData(current, aircraft)
        let saved = await profileStore.saveProfileData(immat, merged, rev, false)
        if (saved?.error === 'conflict') {
          const fresh = await profileStore.getProfile(immat)
          const merged2 = buildProfileData(fresh?.data || {}, aircraft)
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
      } échec(s).`,
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

          {/* Synthèse par avion */}
          {aircrafts && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Plane className="h-5 w-5 text-sky-500" /> Avions détectés (
                {aircrafts.length}) — synthèse pour création des profils
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left bg-slate-50">
                      <th className="px-3 py-2 font-semibold text-slate-700">Avion</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Jours</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Membres par jour × shift</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Total tâches consignes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aircrafts.map((a) => (
                      <tr key={a.immat} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-sky-700">{a.immat}</td>
                        <td className="px-3 py-2">{Object.keys(a.days).sort().join(', ')}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            {Object.entries(a.days).map(([day, d]) => (
                              <div key={day} className="text-xs">
                                <span className="font-semibold text-slate-600">{day} :</span>{' '}
                                {Object.entries(d)
                                  .filter(([k]) => k !== 'consignes')
                                  .map(([shift, members]) => (
                                    <span key={shift} className="ml-2">
                                      <span
                                        className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                                        style={{ backgroundColor: SHIFT_COLORS[shift] || '#64748b' }}
                                      >
                                        {shift}
                                      </span>{' '}
                                      {members.length}
                                    </span>
                                  ))}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-semibold">{a.totalTasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Phase 2 — création des profils */}
          {aircrafts && aircrafts.length > 0 && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Rocket className="h-5 w-5 text-sky-500" /> Création des profils avion
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Crée ou met à jour un profil par immatriculation (code = matricule). Équipes Matin /
                Soir / Nuit pré-remplies avec l'effectif (union de la semaine, remplacement de
                l'effectif précédent), consignes insérées dans le Bloc-notes en [C]. Tâches,
                affectations et autres équipes existantes sont conservées.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={runCreation}
                  disabled={running}
                  className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {running ? 'Création en cours…' : `Créer / mettre à jour les ${aircrafts.length} profils`}
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
                          {selectedShift.charAt(0).toUpperCase() + selectedShift.slice(1)}
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700">Autres shifts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.blocks.map((b, i) => {
                        const tasks = b.shifts[selectedShift] || []
                        const others = ['matin', 'soir', 'nuit']
                          .filter((s) => s !== selectedShift)
                          .filter((s) => (b.shifts[s] || []).length > 0)
                        return (
                          <tr key={i} className="border-b hover:bg-slate-50 align-top">
                            <td className="px-3 py-2 font-mono font-bold text-sky-700 whitespace-nowrap">
                              {b.immat}
                            </td>
                            <td className="px-3 py-2">{b.typeVisite || '—'}</td>
                            <td className="px-3 py-2">{b.heureEntree || '—'}</td>
                            <td className="px-3 py-2 max-w-[340px]">
                              {tasks.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">aucune tâche</span>
                              ) : (
                                <ul className="space-y-0.5">
                                  {tasks.map((t, j) => (
                                    <li key={j} className="text-xs text-slate-600 leading-snug">
                                      · {t}
                                    </li>
                                  ))}
                                </ul>
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
                                    {s} : {(b.shifts[s] || []).length}
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