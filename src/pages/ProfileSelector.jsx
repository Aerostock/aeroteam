import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plane, Plus, Trash2, LogIn } from 'lucide-react'

export default function ProfileSelector() {
  const { profiles, setActiveProfile, createProfile, deleteProfile } = useApp()
  const [name, setName] = useState('')
  const [aircraft, setAircraft] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const handleCreate = () => {
    if (!name.trim()) return
    const id = createProfile(name, aircraft)
    setActiveProfile(id)
    setShowCreate(false)
    setName('')
    setAircraft('')
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Plane className="h-8 w-8 text-sky-500" />
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Aviation</h1>
        </div>
        <p className="text-slate-500 mb-6">
          Choisissez votre profil pour travailler sur votre avion. Chaque profil (leader) a ses propres données isolées.
        </p>

        {profiles.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Plane className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            Aucun profil pour l'instant. Créez-en un pour commencer.
          </div>
        )}

        <div className="space-y-2 mb-4">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 border border-slate-200 rounded-xl px-4 py-3 hover:border-sky-400 hover:bg-sky-50 transition-colors"
            >
              <button
                onClick={() => setActiveProfile(p.id)}
                className="flex-1 text-left flex items-center gap-3"
              >
                <Plane className="h-5 w-5 text-sky-500" />
                <div>
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  {p.aircraft && <p className="text-sm text-slate-500">✈ {p.aircraft}</p>}
                </div>
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveProfile(p.id)}
                  className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-md hover:bg-sky-700 flex items-center gap-1"
                >
                  <LogIn className="h-3.5 w-3.5" /> Ouvrir
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Supprimer le profil « ${p.name} » et toutes ses données ?`)) {
                      deleteProfile(p.id)
                    }
                  }}
                  className="text-slate-400 hover:text-red-600 p-1.5"
                  title="Supprimer le profil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showCreate ? (
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Créer un nouveau profil</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du profil (ex: Leader 1)"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={aircraft}
              onChange={(e) => setAircraft(e.target.value)}
              placeholder="Avion / immatriculation (ex: F-GKXT)"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="flex-1 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
              >
                Créer et ouvrir
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full border-2 border-dashed border-slate-300 text-slate-500 px-4 py-3 rounded-xl hover:border-sky-400 hover:text-sky-600 flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Nouveau profil
          </button>
        )}
      </div>
    </div>
  )
}
