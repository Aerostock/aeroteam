import { useEffect, useState } from 'react'
import * as profileStore from '../lib/profileStore'
import { getCategoryColor, getCategoryLabel } from '../utils/helpers'
import { X, UserCog, Users, ClipboardList } from 'lucide-react'

function StatBox({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

export default function ProfileViewModal({ profile, adminCode, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    // eslint-disable-next-line react/set-state-in-effect -- réinitialisation à l'ouverture du modal
    setData(null)
    setError('')
    setLoading(true)
    profileStore
      .adminGetProfileData(adminCode, profile.id)
      .then((res) => {
        if (cancelled) return
        if (res?.error) setError('Impossible de lire le profil.')
        else setData(res.profile?.data || {})
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de lire le profil (hors ligne ?).')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile, adminCode])

  if (!profile) return null

  const assignedCount = Object.keys(data?.assignments || {}).filter(
    (id) => data.assignments[id]
  ).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-900 text-white rounded-t-xl">
          <h2 className="font-bold flex items-center gap-2">
            <UserCog className="h-5 w-5 text-sky-400" />
            {profile.name}
            <span className="text-sm font-normal text-slate-300">· {profile.aircraft || '—'}</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1" title="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {loading && <p className="text-sm text-slate-400">Chargement…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {data && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="Tâches" value={(data.tasks || []).length} />
                <StatBox label="Affectées" value={assignedCount} />
                <StatBox label="Non affectées" value={(data.tasks || []).length - assignedCount} />
                <StatBox label="Membres" value={(data.members || []).length} />
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-amber-500" /> Consignes ({(data.notes || []).filter((n) => String(n.title || '').startsWith('[C] ')).length})
                </h3>
                {(data.notes || []).filter((n) => String(n.title || '').startsWith('[C] ')).length === 0 && (
                  <p className="text-sm text-slate-400 italic">
                    Aucune consigne importée pour ce profil.
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {(data.notes || [])
                    .filter((n) => String(n.title || '').startsWith('[C] '))
                    .sort((a, b) => String(a.title).localeCompare(String(b.title)))
                    .map((n) => (
                      <div key={n.id} className="border border-amber-200 bg-amber-50/40 rounded-lg p-3">
                        <p className="text-xs font-bold text-amber-800">
                          {String(n.title).replace('[C] ', '')}
                        </p>
                        <p className="whitespace-pre-wrap text-xs text-slate-700 mt-1 leading-relaxed">
                          {n.content || '—'}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-500" /> Équipes du profil (
                  {(data.teams || []).length})
                </h3>
                {(data.teams || []).length === 0 && (
                  <p className="text-sm text-slate-400 italic">
                    Aucune équipe créée — le leader monte ses équipes dans la page « Équipes » de
                    son profil.
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  {(data.teams || []).map((team) => {
                    const teamTasks = (data.tasks || []).filter(
                      (t) => data.assignments?.[t.id] === team.id
                    )
                    const byBlock = {}
                    teamTasks.forEach((t) => {
                      const b = t.taskType || 'AUTRE'
                      if (!byBlock[b]) byBlock[b] = []
                      byBlock[b].push(t)
                    })
                    const blockOrder = Object.entries(byBlock).sort(
                      (a, b) => b[1].length - a[1].length
                    )
                    return (
                      <div
                        key={team.id}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className="px-3 py-2 flex items-center justify-between gap-2 text-white"
                          style={{ backgroundColor: team.color || '#64748b' }}
                        >
                          <span className="font-bold text-sm truncate">{team.name}</span>
                          <span className="text-xs opacity-90 shrink-0">
                            {teamTasks.length} tâche{teamTasks.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {team.members.length === 0 && (
                              <span className="text-xs text-slate-400 italic">—</span>
                            )}
                            {team.members.map((m, i) => (
                              <span
                                key={i}
                                className="bg-slate-100 text-slate-700 rounded-full px-2 py-0.5 text-[11px]"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                          {teamTasks.length > 0 && (
                            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                              {blockOrder.map(([blk, tasks]) => (
                                <div key={blk}>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span
                                      className="text-[10px] font-bold text-white rounded-full px-2 py-0.5"
                                      style={{ backgroundColor: getCategoryColor(blk) }}
                                    >
                                      {getCategoryLabel(blk)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <ul className="space-y-0.5">
                                    {tasks.map((t) => (
                                      <li
                                        key={t.id}
                                        className="text-[11px] text-slate-600 flex gap-1.5"
                                      >
                                        <span className="font-mono font-bold shrink-0">
                                          {t.seq || '—'}
                                        </span>
                                        <span className="truncate" title={t.description}>
                                          {t.description}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}