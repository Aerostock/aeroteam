import { useCallback, useEffect, useState } from 'react'
import * as profileStore from '../lib/profileStore'
import { useApp } from '../context/AppContext'
import { StickyNote, Plus, X, Check, Trash2, Pencil } from 'lucide-react'

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
        await profileStore.addConsigne(titre, editCouleur, editContenu, activeProfile?.name || '')
      } else if (editingId) {
        await profileStore.saveConsigne(
          editingId,
          titre,
          editCouleur,
          editContenu,
          activeProfile?.name || ''
        )
      }
      closeModal()
      await loadConsignes(false)
    } catch {
      setSaveError('Échec de l’enregistrement (hors ligne ?).')
    }
    setSaving(false)
  }

  const remove = async (c) => {
    if (!window.confirm(`Supprimer la consigne « ${c.titre} » ? Cette action est irréversible.`)) return
    try {
      await profileStore.deleteConsigne(c.id)
      await loadConsignes(false)
    } catch {
      setError("Impossible de supprimer la consigne (hors ligne ?).")
    }
  }

  const modalOpen = isNew || editingId !== null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Consignes</h1>
          <p className="text-slate-600 mt-1">
            Tuiles partagées entre tous les profils — tout le monde peut lire et modifier.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Nouvelle consigne
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      {consignes === null && !error && (
        <p className="text-sm text-slate-400">Chargement…</p>
      )}
      {consignes && consignes.length === 0 && (
        <div className="bg-white rounded-xl shadow p-10 text-center text-slate-500">
          <StickyNote className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          Aucune consigne pour le moment. Cliquez sur « Nouvelle consigne » pour la première tuile.
        </div>
      )}

      {consignes && consignes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {consignes.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow overflow-hidden flex flex-col">
              <div
                className="px-4 py-2.5 flex items-center justify-between gap-2"
                style={{ backgroundColor: c.couleur || '#0ea5e9' }}
              >
                <h2 className="font-bold text-white text-sm truncate">{c.titre}</h2>
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    className="text-white/80 hover:text-white p-1"
                    title={`Modifier « ${c.titre} »`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="text-white/80 hover:text-white p-1"
                    title={`Supprimer « ${c.titre} »`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              <div className="p-4 flex-1">
                <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6">{c.contenu || '—'}</p>
              </div>
              <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
                {c.updated_by ? `Mis à jour par ${c.updated_by}` : 'Mis à jour'} ·{' '}
                {c.updated_at ? new Date(c.updated_at).toLocaleString('fr-FR') : ''}
              </div>
            </div>
          ))}
        </div>
      )}

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
              <h2 className="font-bold">{isNew ? 'Nouvelle consigne' : 'Modifier la consigne'}</h2>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Couleur de la tuile</label>
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