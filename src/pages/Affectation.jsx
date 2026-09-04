import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { getCategoryColor, getZoneColor, getCategoryLabel } from '../utils/helpers'
import { Users, ClipboardList, Undo2, ChevronDown, ChevronRight } from 'lucide-react'

export default function Affectation() {
  const { tasks, teams, assignments, assignTask, unassignTask } = useApp()
  const [dragTask, setDragTask] = useState(null)
  const [selectedBlocks, setSelectedBlocks] = useState([])
  const [expandedBlocks, setExpandedBlocks] = useState([])
  const [expandedZones, setExpandedZones] = useState([])

  const toggleBlockCollapse = (block) => {
    setExpandedBlocks((prev) =>
      prev.includes(block) ? prev.filter((b) => b !== block) : [...prev, block]
    )
  }

  const toggleZoneCollapse = (key) => {
    setExpandedZones((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const zones = useMemo(() => {
    return [...new Set(tasks.map((t) => t.workArea).filter(Boolean))].sort()
  }, [tasks])

  const blocks = useMemo(() => {
    return [...new Set(tasks.map((t) => t.taskType).filter(Boolean))].sort()
  }, [tasks])

  const toggleBlock = (block) => {
    setSelectedBlocks((prev) =>
      prev.includes(block) ? prev.filter((b) => b !== block) : [...prev, block]
    )
  }

  const selectAll = () => setSelectedBlocks([])
  const selectNone = () => setSelectedBlocks([...blocks])

  // selectedBlocks = blocs masqués. Vide => tout affiché.
  const visibleBlocksList = useMemo(() => {
    return blocks.filter((b) => !selectedBlocks.includes(b))
  }, [blocks, selectedBlocks])

  // Grouper par bloc
  const groupedByBlock = useMemo(() => {
    const groups = {}
    tasks.forEach((t) => {
      const block = t.taskType || 'AUTRE'
      if (!groups[block]) groups[block] = []
      groups[block].push(t)
    })
    return groups
  }, [tasks])

  // Grouper les tâches d'un bloc par work area
  const groupByZone = (blockTasks) => {
    const groups = {}
    blockTasks.forEach((t) => {
      const zone = t.workArea || 'Autre'
      if (!groups[zone]) groups[zone] = []
      groups[zone].push(t)
    })
    return groups
  }

  const handleDrop = (teamId) => {
    if (dragTask) {
      assignTask(dragTask, teamId)
    }
    setDragTask(null)
  }

  const assignedCount = (teamId) =>
    Object.values(assignments).filter((id) => id === teamId).length

  // Répartition blocs/zones affectés à une équipe (+ numéros de ligne)
  const teamBlocks = (teamId) => {
    const groups = {}
    tasks.forEach((t) => {
      if (assignments[t.id] === teamId && t.taskType) {
        const zone = t.workArea || 'Autre'
        const key = `${t.taskType} / ${zone}`
        if (!groups[key]) groups[key] = { count: 0, seqs: [] }
        groups[key].count += 1
        if (t.seq !== undefined && t.seq !== '') groups[key].seqs.push(String(t.seq))
      }
    })
    Object.values(groups).forEach((g) => g.seqs.sort((a, b) => Number(a) - Number(b)))
    return groups
  }

  // Affecter tout un bloc à une équipe
  const assignWholeBlock = (block, teamId) => {
    const unassigned = tasks.filter((t) => t.taskType === block && !assignments[t.id])
    unassigned.forEach((t) => assignTask(t.id, teamId))
  }

  // Affecter toutes les tâches d'un bloc ET d'une zone à une équipe
  const assignWholeZone = (block, zone, teamId) => {
    const unassigned = tasks.filter(
      (t) => t.taskType === block && (t.workArea || 'Autre') === zone && !assignments[t.id]
    )
    unassigned.forEach((t) => assignTask(t.id, teamId))
  }

  const bulkSelectValue = ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Affectation des tâches</h1>
        <p className="text-slate-600 mt-1">
          Affectez par <strong>bloc complet</strong> (menu en haut de chaque bloc) ou <strong>ligne par ligne</strong>. Glissez-déposez également possible.
        </p>
      </div>

      {/* Filtre multi-blocs */}
      {blocks.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Filtrer par bloc</h2>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-sky-600 hover:underline">Tout afficher</button>
              <span className="text-slate-300">|</span>
              <button onClick={selectNone} className="text-slate-500 hover:underline">Tout masquer</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {blocks.map((block) => {
              const hidden = selectedBlocks.includes(block)
              const active = !hidden
              const color = getCategoryColor(block)
              const count = tasks.filter((t) => t.taskType === block).length
              return (
                <button
                  key={block}
                  onClick={() => toggleBlock(block)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold transition-all border-2"
                  style={{
                    backgroundColor: active ? color : 'transparent',
                    borderColor: color,
                    color: active ? '#fff' : color,
                  }}
                >
                  {getCategoryLabel(block)} ({count})
                </button>
              )
            })}
            {selectedBlocks.length > 0 && (
              <span className="text-xs text-slate-400 self-center">
                Affichage : {visibleBlocksList.length} bloc(s)
              </span>
            )}
          </div>
        </div>
      )}

      {teams.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg">
          Créez d'abord des équipes avant d'affecter des tâches. Allez dans la page « Équipes ».
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {visibleBlocksList.length === 0 && (
            <div className="bg-white rounded-xl shadow p-8 text-center text-slate-500">
              <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              Aucun bloc n'est affiché. Sélectionnez des blocs ci-dessus, ou importez votre fichier Excel.
            </div>
          )}

          {visibleBlocksList.map((block) => {
            const blockTasks = groupedByBlock[block] || []
            const blockColor = getCategoryColor(block)
            const unassignedInBlock = blockTasks.filter((t) => !assignments[t.id])
            const blockExpanded = expandedBlocks.includes(block)
            return (
              <div key={block} className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2" style={{ backgroundColor: blockColor }}>
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleBlockCollapse(block)}>
                    {blockExpanded ? (
                      <ChevronDown className="h-5 w-5 text-white" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-white" />
                    )}
                    <h3 className="font-bold text-white text-sm">
                      Bloc {getCategoryLabel(block)} <span className="font-normal opacity-80">({blockTasks.length})</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-xs">
                      {unassignedInBlock.length} non assignée(s)
                    </span>
                    {teams.length > 0 && (
                      <select
                        value={bulkSelectValue}
                        onChange={(e) => {
                          if (e.target.value) {
                            assignWholeBlock(block, e.target.value)
                            e.target.value = ''
                          }
                        }}
                        className="border-none rounded-md px-2 py-1 text-xs bg-white text-slate-800 cursor-pointer font-semibold flex items-center gap-1"
                        title="Affecter tout le bloc"
                      >
                        <option value="">— Affecter tout le bloc —</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>À {t.name} ({unassignedInBlock.length} tâches)</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {blockExpanded && (
                <div className="p-4 space-y-3">
                  {Object.entries(groupByZone(blockTasks))
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([zone, zoneTasks]) => {
                      const zoneColor = getZoneColor(zone, zones)
                      const unassignedInZone = zoneTasks.filter((t) => !assignments[t.id])
                      const zoneKey = `${block}::${zone}`
                      const zoneExpanded = expandedZones.includes(zoneKey)
                      return (
                        <div
                          key={zone}
                          className="rounded-lg border bg-white overflow-hidden"
                          style={{ borderColor: zoneColor, borderWidth: 2 }}
                        >
                          <div
                            className="px-4 py-2 flex items-center justify-between gap-2"
                            style={{ backgroundColor: zoneColor }}
                          >
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleZoneCollapse(zoneKey)}>
                              {zoneExpanded ? (
                                <ChevronDown className="h-5 w-5 text-white" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-white" />
                              )}
                              <span className="text-sm font-bold text-white">
                                📍 {zone}{' '}
                                <span className="font-normal opacity-90">({zoneTasks.length})</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white/90 text-xs">
                                {unassignedInZone.length} non assignée(s)
                              </span>
                              {teams.length > 0 && unassignedInZone.length > 0 && (
                                <select
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      assignWholeZone(block, zone, e.target.value)
                                      e.target.value = ''
                                    }
                                  }}
                                  className="border-none rounded-md px-2 py-1 text-xs bg-white text-slate-800 cursor-pointer font-semibold"
                                  title="Affecter toute la zone"
                                >
                                  <option value="">— Toute la zone —</option>
                                  {teams.map((t) => (
                                    <option key={t.id} value={t.id}>À {t.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                          {zoneExpanded && (
                          <ul className="divide-y divide-slate-100">
                            {zoneTasks.map((task) => {
                              const assigned = assignments[task.id]
                              const assignedTeam = teams.find((t) => t.id === assigned)
                              return (
                                <li
                                  key={task.id}
                                  draggable={!assigned}
                                  onDragStart={() => setDragTask(task.id)}
                                  onDragEnd={() => setDragTask(null)}
                                  className="px-4 py-2 hover:bg-slate-50 flex items-center gap-3 cursor-grab"
                                >
                                  <span className="w-10 shrink-0 text-center bg-slate-100 rounded-md px-2 py-1 text-xs font-bold text-slate-600">
                                    {task.seq || '—'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" title={task.description}>
                                      {task.description}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {task.registration && `✈ ${task.registration}  `}
                                      {task.skills && `🔧 ${task.skills}  `}
                                    </p>
                                  </div>

                                  {assigned ? (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span
                                        className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                        style={{ backgroundColor: assignedTeam?.color }}
                                      >
                                        {assignedTeam?.name}
                                      </span>
                                      <button
                                        onClick={() => unassignTask(task.id)}
                                        className="text-slate-400 hover:text-red-600"
                                        title="Retirer"
                                      >
                                        <Undo2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <select
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (e.target.value) assignTask(task.id, e.target.value)
                                      }}
                                      className="border border-slate-300 rounded-md px-2 py-1 text-xs shrink-0"
                                      title="Affecter cette ligne"
                                    >
                                      <option value="">— Ligne —</option>
                                      {teams.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </select>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                          )}
                        </div>
                      )
                    })}
                </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl shadow p-4 text-white">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-400" /> Équipes
            </h2>
            {teams.length === 0 && (
              <p className="text-sm text-slate-400">Aucune équipe créée.</p>
            )}
            {teams.map((team) => (
              <div
                key={team.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(team.id)}
                className={`mb-2 rounded-lg transition-colors ${
                  dragTask ? 'ring-2 ring-sky-400 bg-slate-800' : 'bg-slate-800'
                }`}
                style={{ borderLeft: `4px solid ${team.color}` }}
              >
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{team.name}</span>
                    <span className="text-xs text-slate-400">{assignedCount(team.id)} tâche(s)</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-1">
                    {team.members.length === 0 && <span>—</span>}
                    {team.members.map((m, i) => (
                      <span key={i} className="bg-slate-700 rounded-full px-2 py-0.5 text-slate-200">
                        {m}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    {Object.keys(teamBlocks(team.id)).length === 0 && (
                      <span className="text-xs text-slate-500 italic">Aucun bloc affecté</span>
                    )}
                    {Object.entries(teamBlocks(team.id))
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([key, info]) => {
                        const [blk, zone] = key.split(' / ')
                        const color = getCategoryColor(blk)
                        return (
                          <div
                            key={key}
                            className="rounded-md overflow-hidden"
                            style={{ border: `1px solid ${color}` }}
                          >
                            <div
                              className="px-2 py-1 text-[11px] font-bold text-white"
                              style={{ backgroundColor: color }}
                            >
                              {blk} · {zone}{' '}
                              <span className="font-normal opacity-90">
                                ({info.count} tâche{info.count > 1 ? 's' : ''})
                              </span>
                            </div>
                            {info.seqs.length > 0 && (
                              <div className="px-2 py-1 text-[11px] font-mono bg-white text-slate-700">
                                N° : {info.seqs.join(', ')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
