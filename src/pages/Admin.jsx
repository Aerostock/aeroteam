import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import * as profileStore from '../lib/profileStore'
import { ShieldCheck, UserPlus, Plus, KeyRound, Trash2, Users, Pencil, Check, X } from 'lucide-react'

export default function Admin() {
  const { createProfile, activeProfile, changeAdminCode, updateOwnProfile } = useApp()

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

  const [profiles, setProfiles] = useState(null)
  const [profilesError, setProfilesError] = useState('')
  const [deleting, setDeleting] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAircraft, setEditAircraft] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const startEditProfile = (profile) => {
    setEditingId(profile.id)
    setEditName(profile.name)
    setEditAircraft(profile.aircraft || '')
    setEditError('')
  }

  const cancelEditProfile = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEditProfile = async (profile) => {
    const name = editName.trim()
    if (!name) {
      setEditError('Le nom est obligatoire.')
      return
    }
    setEditSaving(true)
    setEditError('')
    const isSelf = profile.id === activeProfile?.id
    let res
    if (isSelf) {
      res = await updateOwnProfile({ name, aircraft: editAircraft.trim() })
    } else {
      try {
        res = await profileStore.adminUpdateProfile(
          activeProfile?.code,
          profile.id,
          name,
          editAircraft.trim()
        )
      } catch {
        res = { ok: false, error: 'Échec de la mise à jour : erreur réseau.' }
      }
    }
    if (!res.ok) {
      setEditError(res.error || 'Échec de la mise à jour.')
    } else {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, name, aircraft: editAircraft.trim() || p.aircraft } : p
        )
      )
      setEditingId(null)
    }
    setEditSaving(false)
  }

  useEffect(() => {
    if (!activeProfile?.code) return
    let cancelled = false
    // eslint-disable-next-line react/set-state-in-effect -- chargement initial de la liste des profils
    setProfilesError('')
    profileStore
      .listProfiles(activeProfile.code)
      .then((res) => {
        if (cancelled) return
        if (res?.error) setProfilesError("Impossible de charger la liste des profils.")
        else setProfiles(res.profiles || [])
      })
      .catch(() => {
        if (!cancelled) setProfilesError('Impossible de charger la liste des profils.')
      })
    return () => {
      cancelled = true
    }
  }, [activeProfile?.code])

  const handleDeleteProfile = async (profile) => {
    if (!activeProfile?.code) return
    if (
      !window.confirm(
        `Supprimer définitivement le profil « ${profile.name} » ?\n\nToutes ses données (tâches, équipes, affectations, notes…) seront effacées. Cette action est IRREVERSIBLE.`
      )
    ) {
      return
    }
    setDeleting(profile.id)
    setProfilesError('')
    try {
      const res = await profileStore.adminDeleteProfile(activeProfile.code, profile.id)
      if (res?.error === 'not_found') setProfilesError("Ce profil n'existe déjà plus.")
      else if (res?.error === 'not_admin') setProfilesError("Le code administrateur n'est plus valide.")
      else if (res?.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
      }
    } catch {
      setProfilesError('Échec de la suppression du profil.')
    }
    setDeleting(null)
  }

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
          <Users className="h-5 w-5 text-sky-500" /> Profils existants
          {profiles && <span className="text-sm font-normal text-slate-400">({profiles.length})</span>}
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Les codes de connexion ne sont jamais affichés par sécurité.
        </p>
        {profilesError && <p className="text-sm text-red-600 mb-3">{profilesError}</p>}
        {profiles === null && !profilesError && (
          <p className="text-sm text-slate-400">Chargement…</p>
        )}
        {profiles && profiles.length === 0 && (
          <p className="text-sm text-slate-400">Aucun profil pour le moment.</p>
        )}
        {profiles && profiles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-slate-50 border-b">
                  <th className="px-3 py-2 font-semibold text-slate-700">Nom</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Avion</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Créé le</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const isSelf = profile.id === activeProfile?.id
                  const isEditing = editingId === profile.id
                  if (isEditing) {
                    return (
                      <tr key={profile.id} className="border-b bg-sky-50/50">
                        <td className="px-3 py-2" colSpan={4}>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Nom du profil"
                              className="flex-1 min-w-[140px] border border-slate-300 rounded-md px-2 py-1 text-sm"
                              autoFocus
                            />
                            <input
                              value={editAircraft}
                              onChange={(e) => setEditAircraft(e.target.value)}
                              placeholder="Avion / immatriculation"
                              className="flex-1 min-w-[140px] border border-slate-300 rounded-md px-2 py-1 text-sm"
                            />
                            {editError && <span className="text-xs text-red-600">{editError}</span>}
                            <button
                              onClick={() => saveEditProfile(profile)}
                              disabled={editSaving}
                              className="flex items-center gap-1 bg-sky-600 text-white px-2.5 py-1 rounded-md text-xs font-semibold hover:bg-sky-700 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" /> {editSaving ? 'Enregistrement…' : 'OK'}
                            </button>
                            <button
                              onClick={cancelEditProfile}
                              className="text-slate-500 hover:text-slate-800 p-1"
                              title="Annuler"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={profile.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">
                        {profile.name}
                        {isSelf && (
                          <span className="ml-2 text-[10px] font-semibold text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
                            votre profil
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{profile.aircraft || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => startEditProfile(profile)}
                          className="text-slate-400 hover:text-sky-600 p-1"
                          title={`Modifier le profil « ${profile.name} »`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isSelf ? (
                          <span className="text-xs text-slate-300 italic ml-1">non supprimable</span>
                        ) : (
                          <button
                            onClick={() => handleDeleteProfile(profile)}
                            disabled={deleting === profile.id}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-50 ml-1"
                            title={`Supprimer le profil « ${profile.name} »`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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