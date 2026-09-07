import { useCallback, useEffect, useState } from 'react'
import * as profileStore from '../lib/profileStore'
import { useApp } from '../context/AppContext'
import { Plus, X, Check, Trash2, Pencil, MessageSquare } from 'lucide-react'

const PALETTE = [
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#3b82f6',
  '#84cc16',
  '#ec4899',
  '#a855f7',
  '#64748b',
]

export default function Consignes() {
  const { activeProfile } = useApp()
  const [consignes, setConsignes] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [editTitre, setEditTitre] = useState('')
  const [editCouleur, setEditCouleur] = useState(PALETTE[0])
  const [editContenu, setEditContenu] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadConsignes = useCallback(
    async (skipIfEditing) => {
      if (skipIfEditing && editingId) return
      try {
        const res = await profileStore.getConsignes()
        setError('')
        setConsignes(res?.consignes || [])
      } catch {
        setError('Impossible de charger les consignes (hors ligne ?).')
      }
    },
    [editingId]
  )

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- chargement initial de la liste
    loadConsignes(false)
    const timer = setInterval(() => loadConsignes(true), 15000)
    return () => clearInterval(timer)
  }, [loadConsignes])

  const openCreate = () => {
    setIsNew(true)
    setEditingId(null)
    setEditTitre('')
    setEditCouleur(PALETTE[0])
    setEditContenu('')
    setSaveError('')
  }

  const openEdit = (c) => {
    setIsNew(false)
    setEditingId(c.id)
    setEditTitre(c.titre)
    setEditCouleur(c.couleur || PALETTE[0])
    setEditContenu(c.contenu || '')
    setSaveError('')
  }

  const closeModal = () => {
    setEditingId(null)
    setIsNew(false)
    setSaveError('')
  }

  const save = async () => {
    const titre = editTitre.trim()
    if (!titre) {
      setSaveError('Le titre est obligatoire.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      if (isNew) {
        const res = await profileStore.addConsigne(titre, editCouleur, editContenu, activeProfile?.name || '')
        closeModal()
        await loadConsignes(false)
        if (res?.id) setSelectedId(res.id)
      } else if (editingId) {
        await profileStore.saveConsigne(
          editingId,
          titre,
          editCouleur,
          editContenu,
          activeProfile?.name || ''
        )
        closeModal()
        await loadConsignes(false)
      }
    } catch {
      setSaveError('Échec de l’enregistrement (hors ligne ?).')
    }
    setSaving(false)
  }

  const remove = async (c) => {
    if (!window.confirm(`Supprimer la consigne « ${c.titre} » ? Cette action est irréversible.`)) return
    try {
      await profileStore.deleteConsigne(c.id)
      if (selectedId === c.id) setSelectedId(null)
      await loadConsignes(false)
    } catch {
      setError("Impossible de supprimer la consigne (hors ligne ?).")
    }
  }

  const modalOpen = isNew || editingId !== null
  const selected = consignes?.find((c) => c.id === selectedId) || null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Consignes</h1>
        <p className="text-slate-600 mt-1">
          Sujets partagés entre tous les profils — cliquez sur un sujet pour ouvrir la conversation.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Liste des onglets */}
        <div className="space-y-3">
          <button
            onClick={openCreate}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Nouveau sujet
          </button>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {consignes === null && !error && (
              <p className="text-sm text-slate-400 p-4">Chargement…</p>
            )}
            {consignes && consignes.length === 0 && (
              <p className="text-sm text-slate-500 p-4">
                Aucun sujet. Créez le premier avec « Nouveau sujet ».
              </p>
            )}
            {consignes &&
              consignes.map((c) => {
                const active = c.id === selectedId
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm border-b border-slate-100 transition-colors ${
                      active
                        ? 'bg-sky-50 border-l-4 border-l-sky-600 font-semibold text-sky-900'
                        : 'text-slate-700 hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                    title={`Ouvrir « ${c.titre} »`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.couleur || '#0ea5e9' }}
                    />
                    <span className="truncate">{c.titre}</span>
                  </button>
                )
              })}
          </div>
        </div>

        {/* Conversation du sujet sélectionné */}
        <div className="bg-white rounded-xl shadow flex flex-col min-h-[300px]">
          {!selected && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
              <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm">
                {consignes && consignes.length > 0
                  ? 'Sélectionnez un sujet dans la liste pour ouvrir sa conversation.'
                  : 'Créez un sujet pour commencer à rédiger des consignes.'}
              </p>
            </div>
          )}

          {selected && (
            <>
              <div
                className="px-5 py-3 flex items-center justify-between gap-3"
                style={{ backgroundColor: selected.couleur || '#0ea5e9' }}
              >
                <div className="min-w-0">
                  <h2 className="font-bold text-white text-lg truncate">{selected.titre}</h2>
                  <p className="text-white/90 text-xs">
                    {selected.updated_by ? `Mis à jour par ${selected.updated_by}` : 'Mis à jour'} ·{' '}
                    {selected.updated_at
                      ? new Date(selected.updated_at).toLocaleString('fr-FR')
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(selected)}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-1.5"
                    title={`Modifier « ${selected.titre} »`}
                  >
                    <Pencil className="h-4 w-4" /> Modifier
                  </button>
                  <button
                    onClick={() => remove(selected)}
                    className="text-white/80 hover:text-white p-2"
                    title={`Supprimer « ${selected.titre} »`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 overflow-y-auto">
                <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
                  {selected.contenu || '—'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-900 text-white rounded-t-xl">
              <h2 className="font-bold">{isNew ? 'Nouveau sujet' : 'Modifier le sujet'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white p-1" title="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
                <input
                  value={editTitre}
                  onChange={(e) => setEditTitre(e.target.value)}
                  placeholder="Ex : Procédure AOG, Regroupement matériel…"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Couleur du bandeau</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditCouleur(color)}
                      className={`h-8 w-8 rounded-full transition-transform ${
                        editCouleur === color ? 'ring-2 ring-slate-800 ring-offset-2 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contenu</label>
                <textarea
                  value={editContenu}
                  onChange={(e) => setEditContenu(e.target.value)}
                  placeholder="Consigne à destination de toutes les équipes…"
                  rows={8}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm resize-y"
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
                >
                  <Check className="h-4 w-4" /> {saving ? 'Enregistrement…' : isNew ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}