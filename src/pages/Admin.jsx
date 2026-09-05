import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ShieldCheck, UserPlus, Plus, KeyRound } from 'lucide-react'

export default function Admin() {
  const { createProfile, activeProfile, changeAdminCode } = useApp()

  const [newName, setNewName] = useState('')
  const [newAircraft, setNewAircraft] = useState('')
  const [newCode, setNewCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [success, setSuccess] = useState('')

  const [adminOld, setAdminOld] = useState('')
  const [adminNew, setAdminNew] = useState('')
  const [adminNew2, setAdminNew2] = useState('')
  const [changing, setChanging] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [adminSuccess, setAdminSuccess] = useState('')

  const handleCreate = async () => {
    setCreating(true)
    setCreateError('')
    setSuccess('')
    const res = await createProfile({ code: newCode, name: newName, aircraft: newAircraft })
    if (!res.ok) setCreateError(res.error)
    else {
      setSuccess(`Profil « ${newName} » créé avec succès.`)
      setNewName('')
      setNewAircraft('')
      setNewCode('')
    }
    setCreating(false)
  }

  const handleChangeAdmin = async () => {
    if (!adminOld.trim() || !adminNew.trim()) {
      setAdminError("Renseignez l'ancien et le nouveau code.")
      return
    }
    if (adminNew !== adminNew2) {
      setAdminError('La confirmation du nouveau code ne correspond pas.')
      return
    }
    setChanging(true)
    setAdminError('')
    setAdminSuccess('')
    const res = await changeAdminCode(adminOld.trim(), adminNew.trim())
    if (!res.ok) setAdminError(res.error)
    else {
      setAdminSuccess('Code administrateur modifié avec succès.')
      setAdminOld('')
      setAdminNew('')
      setAdminNew2('')
    }
    setChanging(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Administration</h1>
        <p className="text-slate-600 mt-1">Création des profils (réservé à l'administrateur)</p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-xl">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-4">
          <UserPlus className="h-5 w-5 text-sky-500" /> Créer un nouveau profil
        </h2>
        <div className="space-y-3">
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
            placeholder="Code personnel (ex: LEADER-123)"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
          <p className="text-xs text-slate-500">
            Ce code est la clé d'accès du profil. Remettez-le aux leaders concernés.
          </p>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newCode.trim()}
            className="flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold w-full"
          >
            <Plus className="h-4 w-4" /> {creating ? 'Création…' : 'Créer le profil'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-xl">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-4">
          <KeyRound className="h-5 w-5 text-sky-500" /> Changer le code administrateur
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Le code administrateur est vérifié côté serveur (jamais dans le code de l'application).
          Utilisez un code d'au moins 8 caractères, différent des codes des profils.
        </p>
        <div className="space-y-3">
          <input
            type="password"
            value={adminOld}
            onChange={(e) => setAdminOld(e.target.value)}
            placeholder="Ancien code administrateur"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
          <input
            type="password"
            value={adminNew}
            onChange={(e) => setAdminNew(e.target.value)}
            placeholder="Nouveau code (8 caractères minimum)"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
          <input
            type="password"
            value={adminNew2}
            onChange={(e) => setAdminNew2(e.target.value)}
            placeholder="Confirmer le nouveau code"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
          />
          {adminError && <p className="text-sm text-red-600">{adminError}</p>}
          {adminSuccess && <p className="text-sm text-green-600">{adminSuccess}</p>}
          <button
            onClick={handleChangeAdmin}
            disabled={changing}
            className="w-full bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-700 disabled:opacity-50 text-sm font-semibold"
          >
            {changing ? 'Modification…' : 'Modifier le code administrateur'}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4" /> Connecté en tant qu'administrateur : {activeProfile?.name}
      </p>
    </div>
  )
}