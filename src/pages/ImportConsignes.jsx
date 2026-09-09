import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  parseConsignesWorkbook,
  summarizeAircrafts,
} from '../lib/consignesExcel'
import { Upload, FileSpreadsheet, Users, Plane, AlertTriangle } from 'lucide-react'

const SHIFT_COLORS = {
  matin: '#10b981',
  soir: '#6366f1',
  nuit: '#3b82f6',
}

export default function ImportConsignes() {
  const fileInputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [aircrafts, setAircrafts] = useState(null)

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
      } catch (err) {
        setError(`Erreur lors de la lecture : ${err.message}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const totalMembers = report
    ? Object.values(report).reduce(
        (acc, sheet) =>
          acc + sheet.effectif.reduce((a, s) => a + s.members.length, 0),
        0
      )
    : 0
  const totalBlocks = report
    ? Object.values(report).reduce((acc, sheet) => acc + sheet.blocks.length, 0)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Import consignes (rapport)</h1>
        <p className="text-slate-600 mt-1">
          Phase 1 — analyse du fichier CONSIGNES S37 : la création des profils avion viendra ensuite.
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
              <div className="text-2xl font-bold text-slate-900">{Object.keys(report).length}</div>
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
                        <td className="px-3 py-2">
                          {Object.keys(a.days).sort().join(', ')}
                        </td>
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

          {Object.entries(report).map(([day, sheet]) => (
            <div key={day} className="bg-white rounded-xl shadow p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-500" /> {day}
                {sheet.date && <span className="text-sm font-normal text-slate-400">· {sheet.date}</span>}
              </h2>
              {sheet.error && <p className="text-sm text-red-600">{sheet.error}</p>}

              <div className="grid gap-4 lg:grid-cols-3 mt-3">
                {sheet.effectif.map(({ shift, members }) => (
                  <div key={shift} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div
                      className="px-3 py-1.5 text-white text-xs font-bold"
                      style={{ backgroundColor: SHIFT_COLORS[shift] || '#64748b' }}
                    >
                      {shift} ({members.length})
                    </div>
                    <ul className="max-h-44 overflow-y-auto divide-y divide-slate-50">
                      {members.map((m, i) => (
                        <li key={i} className="px-3 py-1.5 text-xs flex justify-between gap-2">
                          <span className="truncate">{m.name}</span>
                          <span className="font-mono text-sky-700 shrink-0">
                            {m.aircrafts.join(', ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <h3 className="font-semibold text-slate-700 mt-4 mb-2">
                Blocs de charge ({sheet.blocks.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left bg-slate-50">
                      <th className="px-3 py-2 font-semibold text-slate-700">Avion</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Type de visite</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Heure</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Matin</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Soir</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Nuit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.blocks.map((b, i) => (
                      <tr key={i} className="border-b hover:bg-slate-50 align-top">
                        <td className="px-3 py-2 font-mono font-bold text-sky-700 whitespace-nowrap">
                          {b.immat}
                        </td>
                        <td className="px-3 py-2">{b.typeVisite || '—'}</td>
                        <td className="px-3 py-2">{b.heureEntree || '—'}</td>
                        {['matin', 'soir', 'nuit'].map((s) => (
                          <td key={s} className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: SHIFT_COLORS[s] || '#64748b' }}>
                              {(b.shifts[s] || []).length}
                            </span>
                            {(b.shifts[s] || []).slice(0, 4).length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {(b.shifts[s] || []).slice(0, 4).map((t, j) => (
                                  <li key={j} className="text-[11px] text-slate-600 truncate" title={t}>
                                    · {t}
                                  </li>
                                ))}
                                {(b.shifts[s] || []).length > 4 && (
                                  <li className="text-[10px] text-slate-400">
                                    + {(b.shifts[s] || []).length - 4} autres
                                  </li>
                                )}
                              </ul>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}