import { useCallback, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useApp } from '../context/AppContext'
import { detectColumns, parseExcelRows, getCategoryColor, getCategoryLabel, CATEGORIES } from '../utils/helpers'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Filter } from 'lucide-react'

export default function ImportExcel() {
  const { tasks, addTasks } = useApp()
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [imported, setImported] = useState(false)
  const [stats, setStats] = useState(null)

  const handleFile = useCallback(
    (file) => {
      setError('')
      setImported(false)
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
          const hdr = rows[0]
          const detected = detectColumns(hdr)

          // Vérifier que la description est détectable
          if (detected.description === undefined) {
            setError('Colonne "Task_Name" introuvable. Vérifiez le format du fichier.')
            return
          }

          const parsed = parseExcelRows(rows.slice(1), detected)
          setPreview(parsed)

          // Statistiques de filtrage
          const totalLines = rows.length - 1
          const kept = parsed.length
          const filteredOut = totalLines - kept
          setStats({ totalLines, kept, filteredOut })
        } catch (err) {
          setError(`Erreur lors de la lecture du fichier: ${err.message}`)
        }
      }
      reader.readAsArrayBuffer(file)
    },
    []
  )

  const handleImport = () => {
    if (!preview.length) return
    addTasks(preview)
    setImported(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Importer vos tâches</h1>
        <p className="text-slate-600 mt-1">
          Chargez votre Workpackage Report. Les tâches sont filtrées et classées automatiquement.
        </p>
      </div>

      {/* Rappel des filtres actifs */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
        <h3 className="font-semibold text-sky-800 flex items-center gap-2 mb-2">
          <Filter className="h-5 w-5" /> Filtres d'import actifs
        </h3>
        <div className="text-sm text-sky-700 space-y-1">
          <p>• <strong>Skills (colonne F)</strong> : toutes les valeurs commençant par CABB</p>
          <p>• <strong>MTX Status (colonne G)</strong> : uniquement ACTV et PAUSE</p>
          <p>• <strong>Task Type (colonne H)</strong> : tous les blocs (JIC, Found Fault, MPC, ADHOC, EO)</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      <div
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-white hover:border-sky-400 transition-colors cursor-pointer"
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
          }}
        />
        <Upload className="h-12 w-12 mx-auto text-slate-400" />
        <p className="mt-4 text-lg font-medium text-slate-700">
          Cliquez ou glissez-déposez votre fichier Excel ici
        </p>
        <p className="text-sm text-slate-500 mt-1">Formats supportés : .xlsx, .xls, .csv</p>
        {fileName && (
          <p className="mt-3 inline-flex items-center gap-2 bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-sm">
            <FileSpreadsheet className="h-4 w-4" /> {fileName}
          </p>
        )}
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{stats.totalLines}</div>
            <div className="text-sm text-slate-500">Lignes totales</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.kept}</div>
            <div className="text-sm text-slate-500">Après filtres</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-2xl font-bold text-slate-400">{stats.filteredOut}</div>
            <div className="text-sm text-slate-500">Exclues</div>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between border-b">
            <h2 className="text-xl font-semibold">
              Aperçu — {preview.length} tâches après filtres
            </h2>
            <button
              onClick={handleImport}
              className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" /> Importer les tâches
            </button>
          </div>

          {imported && (
            <div className="bg-green-50 border-b border-green-200 text-green-700 px-6 py-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              {preview.length} tâches importées avec succès !
            </div>
          )}

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left">
                  <th className="px-4 py-2 border-b">N°</th>
                  <th className="px-4 py-2 border-b">Tâche</th>
                  <th className="px-4 py-2 border-b">Skills</th>
                  <th className="px-4 py-2 border-b">Status</th>
                  <th className="px-4 py-2 border-b">Bloc</th>
                  <th className="px-4 py-2 border-b">Zone</th>
                  <th className="px-4 py-2 border-b">Heures</th>
                  <th className="px-4 py-2 border-b">Appareil</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((task, idx) => {
                  const color = getCategoryColor(task.taskType)
                  return (
                    <tr key={idx} style={{ backgroundColor: `${color}12` }} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-500">{task.seq}</td>
                      <td className="px-4 py-2 font-medium max-w-xs truncate" title={task.description}>
                        {task.description}
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                          {task.skills}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            task.mtxStatus === 'ACTV'
                              ? 'bg-green-100 text-green-700'
                              : task.mtxStatus === 'PAUSE'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {task.mtxStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: color }}>
                          {getCategoryLabel(task.taskType)}
                        </span>
                      </td>
                      <td className="px-4 py-2 max-w-[150px] truncate" title={task.workArea}>{task.workArea}</td>
                      <td className="px-4 py-2">{task.scheduledHours || '—'}</td>
                      <td className="px-4 py-2">{task.registration || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Tâches enregistrées ({tasks.length})</h2>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.filter((c) => tasks.some((t) => t.taskType === c)).map((cat) => (
                <span
                  key={cat}
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: getCategoryColor(cat) }}
                >
                  {getCategoryLabel(cat)} : {tasks.filter((t) => t.taskType === cat).length}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
