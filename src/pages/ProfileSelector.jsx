import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plane, Plus, LogIn, KeyRound, ShieldCheck } from 'lucide-react'

export default function ProfileSelector() {
  const { createProfile, connectProfile } = useApp()

  // Connexion
  const [code, setCode] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  // Création
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAircraft, setNewAircraft] = useState('')
  const [newCode, setNewCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const handleConnect = async () => {
    setConnecting(true)
    setConnectError('')
    const res = await connectProfile(code)
    if (!res.ok) setConnectError(res.error)
    setConnecting(false)
  }

  const handleCreate = async () => {
    setCreating(true)
    setCreateError('')
    const res = await createProfile({ code: newCode, name: newName, aircraft: newAircraft })
    if (!res.ok) setCreateError(res.error)
    setCreating(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Plane className="h-8 w-8 text-sky-500" />
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Aviation</h1>
        </div>
        <p className="text-slate-500 mb-6">
          Entrez votre <strong className="text-slate-700">code personnel</strong> pour retrouver votre profil et vos données, sur n'importe quel appareil.
        </p>

        {/* Connexion */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-500" /> Se connecter à mon profil
          </h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            placeholder="Votre code personnel"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
            autoFocus
          />
          {connectError && <p className="text-sm text-red-600">{connectError}</p>}
          <button
            onClick={handleConnect}
            disabled={connecting || !code.trim()}
            className="w-full bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <LogIn className="h-4 w-4" /> {connecting ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>

        {/* Création */}
        {showCreate ? (
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 mt-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-500" /> Créer un nouveau profil
            </h2>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du profil (ex: Leader 1)"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={newAircraft}
              onChange={(e) => setNewAircraft(e.target.value)}
              placeholder="Avion / immatriculation (ex: F-GKXT)"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Choisissez votre code personnel (ex: LEADER-123)"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-slate-500">
              Ce code est votre clé d'accès: gardez-le précieusement, il vous permet de retrouver vos données sur n'importe quel appareil.
            </p>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || !newCode.trim()}
                className="flex-1 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
              >
                {creating ? 'Création…' : 'Créer et ouvrir'}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false)
                  setCreateError('')
                }}
                className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full border-2 border-dashed border-slate-300 text-slate-500 px-4 py-3 rounded-xl hover:border-sky-400 hover:text-sky-600 flex items-center justify-center gap-2 text-sm font-semibold mt-4"
          >
            <Plus className="h-4 w-4" /> Nouveau profil / créer ma clé
          </button>
        )}
      </div>
    </div>
  )
}
