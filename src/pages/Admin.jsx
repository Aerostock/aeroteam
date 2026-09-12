import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { useApp } from '../context/AppContext'
import * as profileStore from '../lib/profileStore'
import ProfileViewModal from '../components/ProfileViewModal'
import {
  ShieldCheck,
  UserPlus,
  Plus,
  KeyRound,
  Trash2,
  Users,
  Pencil,
  Check,
  X,
  UserCog,
  Euro,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react'

export default function Admin() {
  const { createProfile, activeProfile, updateOwnProfile } = useApp()

  const [newName, setNewName] = useState('')
  const [newAircraft, setNewAircraft] = useState('')
  const [newCode, setNewCode] = useState('')
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [success, setSuccess] = useState('')

  const [admins, setAdmins] = useState(null)
  const [addAdminName, setAddAdminName] = useState('')
  const [addAdminCode, setAddAdminCode] = useState('')
  const [adminMsg, setAdminMsg] = useState('')
  const [adminBusy, setAdminBusy] = useState(false)

  const loadAdmins = () => {
    if (!activeProfile?.code) return
    profileStore
      .adminListAdmins(activeProfile.code)
      .then((res) => {
        if (res?.error) return
        setAdmins(res.admins || [])
      })
      .catch(() => {})
  }

  const handleAddAdmin = async () => {
    const name = addAdminName.trim()
    const code = addAdminCode.trim()
    if (!name || !code) {
      setAdminMsg('Le nom et le code sont obligatoires.')
      return
    }
    setAdminBusy(true)
    setAdminMsg('')
    try {
      const exists = await profileStore.getProfile(code)
      if (!exists) {
        setAdminMsg('Aucun profil existant avec ce code — créez d’abord le profil normal.')
        setAdminBusy(false)
        return
      }
      const res = await profileStore.adminAddAdmin(activeProfile?.code, code, name)
      if (res?.error === 'deja_admin') setAdminMsg('Ce code est déjà administrateur.')
      else if (res?.error === 'not_admin') setAdminMsg("Votre code administrateur n'est plus valide.")
      else if (res?.ok) {
        setAdminMsg(`Administrateur « ${name} » ajouté.`)
        setAddAdminName('')
        setAddAdminCode('')
        loadAdmins()
      } else setAdminMsg('Échec de l’ajout.')
    } catch {
      setAdminMsg('Échec de l’ajout (hors ligne ?).')
    }
    setAdminBusy(false)
  }

  const handleRemoveAdmin = async (name) => {
    const code = window.prompt(
      `Retirer l'administrateur « ${name} » ?\nSaisissez le code de cet administrateur pour confirmer.`
    )
    if (!code) return
    setAdminMsg('')
    try {
      const res = await profileStore.adminRemoveAdmin(activeProfile?.code, code)
      if (res?.error === 'dernier_admin') setAdminMsg('Impossible de retirer le dernier administrateur.')
      else if (res?.error === 'not_found') setAdminMsg('Code incorrect pour cet administrateur.')
      else if (res?.ok) {
        setAdminMsg(`Administrateur « ${name} » retiré.`)
        loadAdmins()
      }
    } catch {
      setAdminMsg('Échec du retrait (hors ligne ?).')
    }
  }

  const [profiles, setProfiles] = useState(null)
  const [profilesError, setProfilesError] = useState('')
  const [deleting, setDeleting] = useState(null)

  const [viewProfile, setViewProfile] = useState(null)

  // ---------- Demandes de primes ----------
  const [primes, setPrimes] = useState(null)
  const [primeFilter, setPrimeFilter] = useState('soumise')
  const [primeMontant, setPrimeMontant] = useState(5)
  const [primeError, setPrimeError] = useState('')
  const [primeBusy, setPrimeBusy] = useState(null)

  const loadPrimes = (statut) => {
    if (!activeProfile?.code) return
    profileStore
      .adminListDeclarations(activeProfile.code, statut || primeFilter)
      .then((res) => {
        if (res?.error) setPrimeError("Impossible de charger les demandes.")
        else setPrimes(res.declarations || [])
      })
      .catch(() => setPrimeError("Impossible de charger les demandes."))
  }

  useEffect(() => {
    profileStore
      .getPrimeMontant()
      .then((res) => {
        if (res?.montant) setPrimeMontant(res.montant)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const primeStatutBadge = (s) =>
    s === 'validee'
      ? 'bg-green-100 text-green-800'
      : s === 'refusee'
      ? 'bg-red-100 text-red-800'
      : 'bg-amber-100 text-amber-800'

  const handleValidatePrime = async (id) => {
    setPrimeBusy(id)
    setPrimeError('')
    try {
      await profileStore.adminValidateDeclaration(activeProfile?.code, id)
      loadPrimes()
    } catch {
      setPrimeError("Échec de la validation.")
    }
    setPrimeBusy(null)
  }

  const handleRefusePrime = async (id) => {
    const motif = window.prompt("Motif du refus (obligatoire) :")
    if (!motif || !motif.trim()) return
    setPrimeBusy(id)
    setPrimeError('')
    try {
      const res = await profileStore.adminRefuseDeclaration(activeProfile?.code, id, motif.trim())
      if (res?.error === 'motif_requis') setPrimeError("Le motif est obligatoire.")
      else loadPrimes()
    } catch {
      setPrimeError("Échec du refus.")
    }
    setPrimeBusy(null)
  }

  const handleChangeMontant = async () => {
    const raw = window.prompt('Montant unitaire de la prime (€) :', String(primeMontant))
    const v = parseFloat(raw)
    if (isNaN(v) || v <= 0) return
    try {
      const res = await profileStore.adminSetPrimeMontant(activeProfile?.code, v)
      if (res?.ok) setPrimeMontant(v)
      else setPrimeError('Montant invalide.')
    } catch {
      setPrimeError("Échec de la modification du montant.")
    }
  }

  const exportPrimes = () => {
    const rows = (primes || []).map((d) => [
      d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '',
      d.agent_nom || '',
      d.agent_identifiant || '',
      d.date_intervention || '',
      d.avion || '',
      d.element || '',
      d.description || '',
      Number(d.montant || 0),
      d.statut || '',
      d.motif_refus || '',
      d.decided_at ? new Date(d.decided_at).toLocaleDateString('fr-FR') : '',
    ])
    const perAgent = {}
    ;(primes || []).forEach((d) => {
      const key = d.agent_nom || d.agent_identifiant || '—'
      if (d.statut === 'validee') perAgent[key] = (perAgent[key] || 0) + Number(d.montant || 0)
    })
    const totals = Object.entries(perAgent).map(([agent, montant]) => [agent, Number(montant).toFixed(2)])
    const totalGeneral = Object.values(perAgent).reduce((a, b) => a + b, 0)
    const wsData = [
      ['Date', 'Agent', 'Identifiant', "Date d'intervention", 'Avion', 'Élément', 'Description', 'Montant (€)', 'Statut', 'Motif refus', 'Décidé le'],
      ...rows,
      [],
      ['Totaux par agent (validées)'],
      ...totals,
      ['Total général (€)', Number(totalGeneral).toFixed(2)],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [12, 25, 16, 16, 12, 20, 50, 12, 12, 30, 12].map((wch) => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Primes')
    XLSX.writeFile(wb, `primes-${primeFilter || 'toutes'}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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
    loadAdmins()
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
  }, [activeProfile?.code]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (makeAdmin) {
        try {
          const addRes = await profileStore.adminAddAdmin(
            activeProfile?.code,
            newCode,
            newName
          )
          if (addRes?.ok) loadAdmins()
        } catch {
          // le profil est créé même si l'ajout admin échoue
        }
      }
      setSuccess(
        `Profil « ${newName} » créé avec succès${makeAdmin ? ' et promu administrateur.' : '.'}`
      )
      setNewName('')
      setNewAircraft('')
      setNewCode('')
      setMakeAdmin(false)
    }
    setCreating(false)
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
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={makeAdmin}
              onChange={(e) => setMakeAdmin(e.target.checked)}
              className="h-4 w-4 accent-sky-600"
            />
            Faire de ce profil un <strong>administrateur</strong>
          </label>
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
                      <td className="px-3 py-2 text-slate-600">{profile.aircraft || '»”'}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleDateString('fr-FR')
                          : '»”'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => openProfileView(profile)}
                          className="text-slate-400 hover:text-sky-600 p-1"
                          title={`Voir les équipes du profil « ${profile.name} »`}
                        >
                          <UserCog className="h-4 w-4" />
                        </button>
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

      {viewProfile && (
        <ProfileViewModal
          profile={viewProfile}
          adminCode={activeProfile?.code}
          onClose={() => setViewProfile(null)}
        />
      )}

      {admins && (admins.length > 0 || addAdminName || addAdminCode || adminMsg) && (
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-xl">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800 mb-4">
            <KeyRound className="h-5 w-5 text-sky-500" /> Administrateurs
            <span className="text-sm font-normal text-slate-400">({admins.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Un administrateur est un profil dont le code est inscrit ici (vérifié côté serveur, le
            code n'est jamais affiché). Le dernier administrateur ne peut pas être retiré.
          </p>
          {admins.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg mb-3">
              {admins.map((a) => (
                <li key={a.name} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm font-medium text-slate-800">{a.name}</span>
                  <button
                    onClick={() => handleRemoveAdmin(a.name)}
                    disabled={adminBusy || admins.length <= 1}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-40"
                    title={
                      admins.length <= 1
                        ? 'Impossible de retirer le dernier administrateur'
                        : `Retirer « ${a.name} »`
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={addAdminName}
              onChange={(e) => setAddAdminName(e.target.value)}
              placeholder="Nom (ex : Manager)"
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={addAdminCode}
              onChange={(e) => setAddAdminCode(e.target.value)}
              placeholder="Code du profil existant"
              className="border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={handleAddAdmin}
              disabled={adminBusy}
              className="flex items-center justify-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
            >
              <UserPlus className="h-4 w-4" /> Ajouter
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Le code doit correspondre à un profil existant (créez-le d'abord dans « Créer un
            nouveau profil » si besoin).
          </p>
          {adminMsg && <p className="text-sm text-sky-700 mt-2">{adminMsg}</p>}
        </div>
      )}

      {/* Demandes de primes (AeroPrimes) */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <Euro className="h-5 w-5 text-emerald-500" /> Demandes de primes
            {primes && <span className="text-sm font-normal text-slate-400">({primes.length})</span>}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={primeFilter}
              onChange={(e) => {
                setPrimeFilter(e.target.value)
                loadPrimes(e.target.value)
              }}
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="soumise">À valider</option>
              <option value="validee">Validées</option>
              <option value="refusee">Refusées</option>
              <option value="">Toutes</option>
            </select>
            <button
              onClick={exportPrimes}
              disabled={!primes || primes.length === 0}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm font-semibold"
              title="Exporter les demandes affichées en Excel"
            >
              <FileSpreadsheet className="h-4 w-4" /> Exporter Excel
            </button>
            <span className="text-sm text-slate-600 inline-flex items-center gap-1">
              <Euro className="h-4 w-4 text-emerald-500" /> {primeMontant.toFixed(2)} €
            </span>
            <button
              onClick={handleChangeMontant}
              className="text-sky-600 hover:underline text-xs"
              title="Modifier le montant unitaire de la prime"
            >
              modifier
            </button>
          </div>
        </div>
        {primeError && <p className="text-sm text-red-600 mb-3">{primeError}</p>}
        {primes === null && <p className="text-sm text-slate-400">Chargement…</p>}
        {primes && primes.length === 0 && (
          <p className="text-sm text-slate-400 italic">
            Aucune demande {primeFilter ? `(${primeFilter})` : ''} pour le moment.
          </p>
        )}
        {primes && primes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left bg-slate-50">
                  <th className="px-3 py-2 font-semibold text-slate-700">Envoyée le</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Agent</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Avion</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Élément</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Description</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Intervention</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Montant</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Statut</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Décision</th>
                </tr>
              </thead>
              <tbody>
                {primes.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-slate-50 align-top">
                    <td className="px-3 py-2 text-slate-500">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{d.agent_nom || '—'}</span>
                      <span className="block text-[11px] text-slate-400">{d.agent_identifiant}</span>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-sky-700">{d.avion || '—'}</td>
                    <td className="px-3 py-2">{d.element || '—'}</td>
                    <td className="px-3 py-2 max-w-[240px]">
                      <span className="truncate block" title={d.description}>{d.description}</span>
                    </td>
                    <td className="px-3 py-2">
                      {d.date_intervention
                        ? new Date(d.date_intervention).toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-semibold">{Number(d.montant || 0).toFixed(2)} €</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${primeStatutBadge(d.statut)}`}>
                        {d.statut === 'validee' ? 'Validée' : d.statut === 'refusee' ? 'Refusée' : 'Soumise'}
                      </span>
                      {d.statut === 'refusee' && d.motif_refus && (
                        <span className="block text-[11px] text-red-600 mt-0.5" title={d.motif_refus}>
                          {d.motif_refus}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {d.statut === 'soumise' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleValidatePrime(d.id)}
                            disabled={primeBusy === d.id}
                            className="flex items-center gap-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded px-2 py-1 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Valider
                          </button>
                          <button
                            onClick={() => handleRefusePrime(d.id)}
                            disabled={primeBusy === d.id}
                            className="flex items-center gap-1 text-xs font-semibold text-red-600 border border-red-300 hover:bg-red-50 rounded px-2 py-1 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Refuser
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4" /> Connecté en tant qu'administrateur : {activeProfile?.name}
      </p>
    </div>
  )
}
