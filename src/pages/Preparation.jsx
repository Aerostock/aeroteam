import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useApp } from '../context/AppContext'
import { detectColumns, parseExcelRows, getCategoryColor, getZoneColor } from '../utils/helpers'
import { Upload, FileSpreadsheet, Trash2, X, ChevronDown, ChevronRight, FolderClock } from 'lucide-react'

export default function Preparation() {
  const { prepTasks, addPrepTasks, removePrepTask, removePrepTasksByBlock, clearPrepTasks } = useApp()
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState([])

  // Replie par défaut chaque nouveau bloc (tuiles fermées au chargement)
  useEffect(() => {
    setCollapsed((prev) => [...new Set([...prev, ...blocks])])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.join('|')])

  const handleFile = useCallback((file) => {
    setError('')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        if (!rows || rows.length < 2) {
          setError('Le fichier est vide ou ne contient pas assez de lignes.')
          return
        }
        const detected = detectColumns(rows[0])
        if (detected.description === undefined) {
          setError('Colonne "Task_Name" introuvable. Vérifiez le format du fichier.')
          return
        }
        setPreview(parseExcelRows(rows.slice(1), detected))
      } catch (err) {
        setError(`Erreur lors de la lecture du fichier: ${err.message}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleImport = () => {
    if (!preview.length) return
    addPrepTasks(preview)
    setPreview([])
    setFileName('')
  }

  const toggleBlock = (block) => {
    setCollapsed((prev) =>
      prev.includes(block) ? prev.filter((b) => b !== block) : [...prev, block]
    )
  }

  const blocks = useMemo(() => {
    return [...new Set(prepTasks.map((t) => t.taskType).filter(Boolean))].sort()
  }, [prepTasks])

  // Regrouper par bloc, puis par zone
  const byBlock = useMemo(() => {
    const map = {}
    prepTasks.forEach((t) => {
      const blk = t.taskType || 'AUTRE'
      if (!map[blk]) map[blk] = { zones: {}, totalHours: 0, count: 0 }
      const zone = t.workArea || 'Sans zone'
      if (!map[blk].zones[zone]) map[blk].zones[zone] = []
      map[blk].zones[zone].push(t)
      map[blk].count += 1
      const h = parseFloat(t.scheduledHours)
      if (!isNaN(h)) map[blk].totalHours += h
    })
    // Trier les zones par nom dans chaque bloc
    Object.keys(map).forEach((blk) => {
      map[blk].zones = Object.fromEntries(
        Object.entries(map[blk].zones).sort((a, b) => a[0].localeCompare(b[0]))
      )
    })
    return map
  }, [prepTasks])

  const allZones = useMemo(() => {
    return [...new Set(prepTasks.map((t) => t.workArea).filter(Boolean))].sort()
  }, [prepTasks])

  const formatHours = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Préparation de charge</h1>
          <p className="text-slate-600 mt-1">
            Charge restante pour la vacation suivante — {prepTasks.length} lignes
            {blocks.length > 0 && ` · ${blocks.length} blocs`}
          </p>
        </div>
        {prepTasks.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Effacer toute la préparation de charge actuelle ?')) clearPrepTasks()
            }}
            className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 px-3 py-2 rounded-md"
          >
            <X className="h-4 w-4" /> Tout effacer
          </button>
        )}
      </div>

      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-6 sm:p-8 text-center bg-white hover:border-sky-400 transition-colors cursor-pointer"
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
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files[0]) handleFile(e.target.files[0])
            e.target.value = ''
          }}
        />
        <Upload className="h-10 w-10 mx-auto text-slate-400" />
        <p className="mt-3 font-medium text-slate-700">
          Chargez le fichier de la charge restante (fin de journée)
        </p>
        <p className="text-sm text-slate-500 mt-1">Formats supportés : .xlsx, .xls, .csv</p>
        {fileName && (
          <p className="mt-3 inline-flex items-center gap-2 bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-sm">
            <FileSpreadsheet className="h-4 w-4" /> {fileName}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {preview.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b">
            <h2 className="text-lg font-semibold">
              Aperçu — {preview.length} lignes chargées
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPreview([])
                  setFileName('')
                }}
                className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleImport}
                className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm font-semibold"
              >
                Ajouter à la préparation ({preview.length})
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left">
                  <th className="px-4 py-2 border-b">N°</th>
                  <th className="px-4 py-2 border-b">Sous-tâche</th>
                  <th className="px-4 py-2 border-b">Bloc</th>
                  <th className="px-4 py-2 border-b">Zone</th>
                  <th className="px-4 py-2 border-b">Heures</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((task, idx) => (
                  <tr key={idx} style={{ backgroundColor: `${getCategoryColor(task.taskType)}12` }} className="border-b">
                    <td className="px-4 py-2 text-slate-500">{task.seq || '-'}</td>
                    <td className="px-4 py-2 font-medium max-w-xs truncate" title={task.description}>{task.description}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: getCategoryColor(task.taskType) }}>
                        {task.taskType || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2 max-w-[150px] truncate" title={task.workArea}>{task.workArea || '-'}</td>
                    <td className="px-4 py-2">{task.scheduledHours ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {blocks.length === 0 && preview.length === 0 && (
        <div className="bg-white rounded-xl shadow p-10 text-center text-slate-500">
          <FolderClock className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          Aucune charge de préparation. Chargez le fichier de charge restante ci-dessus.
        </div>
      )}

      {blocks.length > 0 && (
        <div className="grid gap-4">
          {blocks
            .map((blk) => ({ blk, ...byBlock[blk] }))
            .sort((a, b) => b.totalHours - a.totalHours)
            .map(({ blk, zones, totalHours, count }) => {
              const color = getCategoryColor(blk)
              const isCollapsed = collapsed.includes(blk)
              const zoneNames = Object.keys(zones)
              return (
                <div key={blk} className="bg-white rounded-xl shadow overflow-hidden">
                  <div
                    className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 cursor-pointer"
                    style={{ backgroundColor: color }}
                    onClick={() => toggleBlock(blk)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-5 w-5 text-white" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-white" />
                      )}
                      <h2 className="font-bold text-white text-lg">
                        {blk}{' '}
                        <span className="font-normal opacity-80">({count})</span>
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-white/25 px-2.5 py-1 rounded-full text-xs font-semibold text-white">
                        {formatHours(totalHours)} h
                      </span>
                      <span className="hidden sm:block text-white/90 text-sm">
                        {zoneNames.length} zone{zoneNames.length > 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Supprimer tout le bloc ${blk} (${count} lignes) ?`)) {
                            removePrepTasksByBlock(blk)
                          }
                        }}
                        className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded"
                        title={`Supprimer le bloc ${blk}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {zoneNames.map((zone) => (
                        <div key={zone} className="py-2">
                          <div
                            className="px-4 sm:px-5 py-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
                            style={{ color: getZoneColor(zone, allZones) }}
                          >
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: getZoneColor(zone, allZones) }}
                            />
                            {zone}
                            <span className="text-slate-400 font-normal normal-case">
                              ({zones[zone].length})
                            </span>
                          </div>
                          <ul className="px-4 sm:px-5 divide-y divide-slate-50">
                            {zones[zone].map((task) => {
                              const h = parseFloat(task.scheduledHours)
                              return (
                                <li key={task.id} className="flex items-center gap-3 py-1.5 group">
                                  <span className="text-xs font-mono text-slate-400 w-12 shrink-0">
                                    {task.seq || '-'}
                                  </span>
                                  <span
                                    className="flex-1 text-sm text-slate-700 truncate"
                                    title={task.description}
                                  >
                                    {task.description}
                                  </span>
                                  <span className="text-xs text-slate-500 shrink-0 w-14 text-right">
                                    {!isNaN(h) ? `${formatHours(h)} h` : ''}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (window.confirm('Supprimer cette ligne ?')) removePrepTask(task.id)
                                    }}
                                    className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    title="Supprimer cette ligne"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
