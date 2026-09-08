import { useCallback, useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import * as profileStore from '../lib/profileStore'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { hashCodeKey, currentWeekLabel } from '../utils/helpers'
import RichEditor from '../components/RichEditor'
import {
  Plus,
  X,
  Check,
  Trash2,
  Pencil,
  MessageSquare,
  ImagePlus,
  Send,
  FolderOpen,
  Folder,
  Plane,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

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
  const { activeProfile, code, isAdmin } = useApp()
  const [consignes, setConsignes] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState(null)
  const [messagesError, setMessagesError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [editTitre, setEditTitre] = useState('')
  const [editCouleur, setEditCouleur] = useState(PALETTE[0])
  const [editContenu, setEditContenu] = useState('')
  const [editContenuHtml, setEditContenuHtml] = useState('')
  const [editSemaine, setEditSemaine] = useState('')
  const [editAvion, setEditAvion] = useState('')
  const [expandedWeeks, setExpandedWeeks] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [replyText, setReplyText] = useState('')
  const [replyHtml, setReplyHtml] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [replyPreviews, setReplyPreviews] = useState([])
  const [sending, setSending] = useState(false)
  const [replyError, setReplyError] = useState('')

  const [myKey, setMyKey] = useState('')

  useEffect(() => {
    let cancelled = false
    hashCodeKey(code).then((key) => {
      if (!cancelled) setMyKey(key)
    })
    return () => {
      cancelled = true
    }
  }, [code])

  const loadConsignes = useCallback(
    async (skipIfEditing) => {
      if (skipIfEditing && editingId) return
      try {
        const res = await profileStore.getConsignes()
        setError('')
        setConsignes(res?.consignes || [])
      } catch {
        setError('Impossible de charger les sujets (hors ligne ?).')
      }
    },
    [editingId]
  )

  const loadMessages = useCallback(async (consigneId) => {
    try {
      const res = await profileStore.getMessages(consigneId)
      setMessagesError('')
      setMessages(res?.messages || [])
    } catch {
      setMessagesError('Impossible de charger la conversation (hors ligne ?).')
      setMessages([])
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- chargement initial de la liste
    loadConsignes(false)
    const timer = setInterval(() => loadConsignes(true), 15000)
    return () => clearInterval(timer)
  }, [loadConsignes])

  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react/set-state-in-effect -- fermeture de la conversation
      setMessages(null)
      setMessagesError('')
      return
    }
    // eslint-disable-next-line react/set-state-in-effect -- ouverture de la conversation
    setMessages(null)
    loadMessages(selectedId)
    const timer = setInterval(() => loadMessages(selectedId), 15000)
    return () => clearInterval(timer)
  }, [selectedId, loadMessages])

  const openCreate = () => {
    setIsNew(true)
    setEditingId(null)
    setEditTitre('')
    setEditCouleur(PALETTE[0])
    setEditContenu('')
    setEditContenuHtml('')
    setEditSemaine(currentWeekLabel())
    setEditAvion(activeProfile?.aircraft || '')
    setSaveError('')
  }

  const openEdit = (c) => {
    setIsNew(false)
    setEditingId(c.id)
    setEditTitre(c.titre)
    setEditCouleur(c.couleur || PALETTE[0])
    setEditContenu('')
    setEditContenuHtml('')
    setEditSemaine(c.semaine || '')
    setEditAvion(c.avion || '')
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
        const res = await profileStore.addConsigne(
          titre,
          editCouleur,
          editContenu,
          editContenuHtml,
          activeProfile?.name || '',
          myKey,
          editSemaine.trim() || '',
          editAvion.trim() || ''
        )
        closeModal()
        await loadConsignes(false)
        if (res?.id) {
          setSelectedId(res.id)
          setExpandedWeeks((prev) => {
            const semaine = editSemaine.trim() || ''
            return semaine && !prev.includes(semaine) ? [...prev, semaine] : prev
          })
        }
      } else if (editingId) {
        await profileStore.saveConsigne(
          editingId,
          titre,
          editCouleur,
          editSemaine.trim() || '',
          editAvion.trim() || '',
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
    if (!window.confirm(`Supprimer le sujet « ${c.titre} » et toute sa conversation ? Cette action est irréversible.`)) return
    try {
      await profileStore.deleteConsigne(c.id)
      if (selectedId === c.id) setSelectedId(null)
      await loadConsignes(false)
    } catch {
      setError("Impossible de supprimer le sujet (hors ligne ?).")
    }
  }

  const removeReply = async (m) => {
    if (!window.confirm('Supprimer cette réponse ? Cette action est irréversible.')) return
    try {
      const res = await profileStore.deleteMessage(m.id, myKey, code)
      if (res?.error === 'not_authorized') {
        setMessagesError('Vous ne pouvez supprimer que vos propres réponses.')
        return
      }
      if (selectedId) await loadMessages(selectedId)
    } catch {
      setMessagesError("Impossible de supprimer la réponse (hors ligne ?).")
    }
  }

  const onPickFiles = (fileList) => {
    const files = Array.from(fileList || []).slice(0, 5 - replyFiles.length)
    if (!files.length) return
    setReplyFiles((prev) => [...prev, ...files])
    setReplyPreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ])
  }

  const removePendingFile = (idx) => {
    setReplyFiles((prev) => prev.filter((_, i) => i !== idx))
    setReplyPreviews((prev) => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  const sendReply = async () => {
    if (!replyText && replyFiles.length === 0) return
    if (!selectedId) return
    setSending(true)
    setReplyError('')
    try {
      const urls = []
      for (let i = 0; i < replyFiles.length; i++) {
        const file = replyFiles[i]
        const path = `msg-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`
        const { error: uploadError } = await supabase.storage
          .from('consignes-images')
          .upload(path, file, { contentType: file.type })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('consignes-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
      await profileStore.addMessage(selectedId, replyText, replyHtml, urls, activeProfile?.name || '', myKey)
      setReplyText('')
      setReplyHtml('')
      replyPreviews.forEach((p) => URL.revokeObjectURL(p))
      setReplyFiles([])
      setReplyPreviews([])
      await loadMessages(selectedId)
      await loadConsignes(false)
    } catch {
      setReplyError('Échec de l’envoi (hors ligne ? photo trop lourde ?).')
    }
    setSending(false)
  }

  // Arborescence semaine -> avion -> sujets
  const grouped = useMemo(() => {
    const weeks = {}
    ;(consignes || []).forEach((c) => {
      const semaine = c.semaine || 'Sans semaine'
      const avion = c.avion || 'Sans avion'
      if (!weeks[semaine]) weeks[semaine] = {}
      if (!weeks[semaine][avion]) weeks[semaine][avion] = []
      weeks[semaine][avion].push(c)
    })
    return Object.entries(weeks)
      .map(([semaine, avions]) => ({
        semaine,
        weekNum: parseInt((String(semaine).match(/\d+/) || [0])[0], 10) || 0,
        avions: Object.entries(avions)
          .map(([avion, sujets]) => ({ avion, sujets }))
          .sort((a, b) => a.avion.localeCompare(b.avion)),
      }))
      .sort((a, b) => b.weekNum - a.weekNum)
  }, [consignes])

  const semaineOptions = useMemo(
    () => [...new Set((consignes || []).map((c) => c.semaine).filter(Boolean))].sort().reverse(),
    [consignes]
  )
  const avionOptions = useMemo(
    () => [...new Set((consignes || []).map((c) => c.avion).filter(Boolean))].sort(),
    [consignes]
  )

  // La semaine la plus récente est ouverte par défaut
  useEffect(() => {
    if (consignes && consignes.length > 0 && expandedWeeks.length === 0 && grouped.length > 0) {
      setExpandedWeeks([grouped[0].semaine])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consignes, grouped.length])

  const toggleWeek = (semaine) => {
    setExpandedWeeks((prev) =>
      prev.includes(semaine) ? prev.filter((w) => w !== semaine) : [...prev, semaine]
    )
  }

  const modalOpen = isNew || editingId !== null
  const selected = consignes?.find((c) => c.id === selectedId) || null
  const canSend = !sending && (replyText !== '' || replyFiles.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Consignes</h1>
        <p className="text-slate-600 mt-1">
          Sujets partagés entre tous les profils — cliquez sur un sujet pour ouvrir sa conversation.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Liste des sujets */}
        <div className="space-y-3">
          <button
            onClick={openCreate}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Nouveau sujet
          </button>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {consignes === null && !error && <p className="text-sm text-slate-400 p-4">Chargement…</p>}
            {consignes && consignes.length === 0 && (
              <p className="text-sm text-slate-500 p-4">
                Aucun sujet. Créez le premier avec « Nouveau sujet ».
              </p>
            )}
            {grouped.length > 0 &&
              grouped.map(({ semaine, avions }) => {
                const open = expandedWeeks.includes(semaine)
                const totalSujets = avions.reduce((acc, a) => acc + a.sujets.length, 0)
                return (
                  <div key={semaine}>
                    <button
                      onClick={() => toggleWeek(semaine)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm border-b border-slate-100 transition-colors ${
                        open ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      title={open ? `Replier la ${semaine}` : `Déplier la ${semaine}`}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      {open ? (
                        <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate">{semaine}</span>
                      <span className="ml-auto text-xs text-slate-400 shrink-0">
                        {totalSujets} sujet{totalSujets > 1 ? 's' : ''}
                      </span>
                    </button>
                    {open &&
                      avions.map(({ avion, sujets }) => (
                        <div key={avion}>
                          <div className="flex items-center gap-2 px-4 pl-9 py-1.5 text-xs font-bold text-slate-500 border-b border-slate-50">
                            <Plane className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            <span className="truncate">{avion}</span>
                            <span className="ml-auto text-slate-400 font-normal shrink-0">
                              ({sujets.length})
                            </span>
                          </div>
                          {sujets.map((c) => {
                            const active = c.id === selectedId
                            return (
                              <button
                                key={c.id}
                                onClick={() => setSelectedId(c.id)}
                                className={`w-full flex items-center gap-2 px-4 pl-12 py-2.5 text-left text-sm border-b border-slate-50 transition-colors ${
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
                      ))}
                  </div>
                )
              })}
          </div>
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-xl shadow flex flex-col min-h-[420px]">
          {!selected && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
              <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm">
                {consignes && consignes.length > 0
                  ? 'Sélectionnez un sujet dans la liste pour ouvrir sa conversation.'
                  : 'Créez un sujet pour commencer à échanger.'}
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
                    <span className="font-semibold">
                      {selected.semaine || 'Sans semaine'} · {selected.avion || 'Sans avion'}
                    </span>{' '}
                    ·{' '}
                    {selected.updated_by
                      ? `dernière activité par ${selected.updated_by}`
                      : 'dernière activité'}{' '}
                    · {selected.updated_at ? new Date(selected.updated_at).toLocaleString('fr-FR') : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(selected)}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-1.5"
                    title={`Modifier le sujet « ${selected.titre} »`}
                  >
                    <Pencil className="h-4 w-4" /> Modifier
                  </button>
                  <button
                    onClick={() => remove(selected)}
                    className="text-white/80 hover:text-white p-2"
                    title={`Supprimer le sujet « ${selected.titre} » et sa conversation`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {messagesError && (
                <p className="m-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {messagesError}
                </p>
              )}

              <div className="flex-1 overflow-y-auto max-h-[50vh] p-4 space-y-3">
                {messages === null && <p className="text-sm text-slate-400 p-2">Chargement…</p>}
                {messages && messages.length === 0 && (
                  <p className="text-sm text-slate-400 p-2">
                    Aucune réponse pour le moment. Écrivez la première.
                  </p>
                )}
                {messages &&
                  messages.map((m) => {
                    const mine = m.auteur_key && m.auteur_key === myKey
                    const canDelete = mine || isAdmin
                    return (
                      <div
                        key={m.id}
                        className={`border rounded-lg overflow-hidden ${
                          mine ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200'
                        }`}
                      >
                        <div
                          className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 ${
                            mine ? 'bg-sky-100/60 border-sky-100' : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <span className="text-xs font-semibold text-slate-700">
                            {m.auteur || '—'}{' '}
                            <span className="font-normal text-slate-400">
                              · {new Date(m.created_at).toLocaleString('fr-FR')}
                            </span>
                          </span>
                          {canDelete && (
                            <button
                              onClick={() => removeReply(m)}
                              className="text-slate-400 hover:text-red-600"
                              title={
                                mine
                                  ? 'Supprimer votre réponse'
                                  : 'Supprimer cette réponse (administrateur)'
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="p-3">
                          {m.contenu_html ? (
                            <div
                              className="message-html text-sm text-slate-800"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(m.contenu_html),
                              }}
                            />
                          ) : m.contenu ? (
                            <p className="whitespace-pre-wrap text-sm text-slate-800">{m.contenu}</p>
                          ) : null}
                          {(m.images || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {(m.images || []).map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" title="Ouvrir la photo en grand">
                                  <img
                                    src={url}
                                    alt={m.contenu ? m.contenu.slice(0, 40) : 'photo'}
                                    className="h-28 w-28 object-cover rounded-md border border-slate-200 bg-slate-100"
                                  />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Saisie d'une réponse */}
              <div className="border-t p-4 bg-slate-50">
                <RichEditor
                  onChange={(html, text) => {
                    setReplyHtml(html)
                    setReplyText(text)
                  }}
                  placeholder={`Répondre à ${selected.titre}…`}
                  minHeight={70}
                />
                {replyPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {replyPreviews.map((preview, i) => (
                      <div key={i} className="relative">
                        <img
                          src={preview}
                          alt="À envoyer"
                          className="h-16 w-16 object-cover rounded-md border border-slate-300"
                        />
                        <button
                          onClick={() => removePendingFile(i)}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5"
                          title="Retirer la photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {replyError && <p className="text-sm text-red-600 mt-2">{replyError}</p>}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <label
                    className="inline-flex items-center gap-1.5 bg-slate-200 text-slate-700 px-3 py-2 rounded-md hover:bg-slate-300 text-sm cursor-pointer"
                    title={`Ajouter des photos (${replyFiles.length}/5)`}
                  >
                    <ImagePlus className="h-4 w-4" />
                    {replyFiles.length > 0 ? `Photos (${replyFiles.length})` : 'Ajouter des photos'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        onPickFiles(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    onClick={sendReply}
                    disabled={!canSend}
                    className="flex items-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <Send className="h-4 w-4" /> {sending ? 'Envoi…' : 'Envoyer'}
                  </button>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Semaine
                  </label>
                  <input
                    value={editSemaine}
                    onChange={(e) => setEditSemaine(e.target.value)}
                    placeholder="Ex : Semaine 37"
                    list="consignes-semaines"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                  <datalist id="consignes-semaines">
                    {semaineOptions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Avion</label>
                  <input
                    value={editAvion}
                    onChange={(e) => setEditAvion(e.target.value)}
                    placeholder="Ex : F-GKXT"
                    list="consignes-avions"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  />
                  <datalist id="consignes-avions">
                    {avionOptions.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
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
              {isNew && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Premier message
                  </label>
                  <RichEditor
                    onChange={(html, text) => {
                      setEditContenu(text)
                      setEditContenuHtml(html)
                    }}
                    placeholder="Le message de lancement du sujet…"
                    minHeight={120}
                  />
                </div>
              )}
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