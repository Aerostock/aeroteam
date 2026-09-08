import { useCallback, useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import * as profileStore from '../lib/profileStore'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { hashCodeKey } from '../utils/helpers'
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
  FolderPlus,
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
  const [folders, setFolders] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [messages, setMessages] = useState(null)
  const [messagesError, setMessagesError] = useState('')

  const [expanded, setExpanded] = useState([])

  // Modale sujet
  const [editingId, setEditingId] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [draftDossierId, setDraftDossierId] = useState(null)
  const [editTitre, setEditTitre] = useState('')
  const [editCouleur, setEditCouleur] = useState(PALETTE[0])
  const [editContenu, setEditContenu] = useState('')
  const [editContenuHtml, setEditContenuHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Modale dossier
  const [folderModal, setFolderModal] = useState(null)
  const [folderName, setFolderName] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)
  const [folderError, setFolderError] = useState('')

  const [myKey, setMyKey] = useState('')

  const [replyText, setReplyText] = useState('')
  const [replyHtml, setReplyHtml] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [replyPreviews, setReplyPreviews] = useState([])
  const [sending, setSending] = useState(false)
  const [replyError, setReplyError] = useState('')

  useEffect(() => {
    let cancelled = false
    hashCodeKey(code).then((key) => {
      if (!cancelled) setMyKey(key)
    })
    return () => {
      cancelled = true
    }
  }, [code])

  const loadAll = useCallback(
    async (skipIfEditing) => {
      if (skipIfEditing && (editingId || folderModal)) return
      try {
        const [fRes, cRes] = await Promise.all([
          profileStore.getFolders(),
          profileStore.getConsignes(),
        ])
        setError('')
        setFolders(fRes?.folders || [])
        setConsignes(cRes?.consignes || [])
      } catch {
        setError('Impossible de charger les consignes (hors ligne ?).')
      }
    },
    [editingId, folderModal]
  )

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- chargement initial
    loadAll(false)
    const timer = setInterval(() => loadAll(true), 15000)
    return () => clearInterval(timer)
  }, [loadAll])

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

  // Arborescence : dossiers semaines -> dossiers avions -> sujets
  const tree = useMemo(() => {
    const folderList = folders || []
    const folderMap = new Map(folderList.map((f) => [f.id, f]))
    const byParent = {}
    folderList.forEach((f) => {
      const key = f.parent_id || 'root'
      if (!byParent[key]) byParent[key] = []
      byParent[key].push(f)
    })
    const topicsByFolder = {}
    ;(consignes || []).forEach((c) => {
      const key = c.dossier_id || 'none'
      if (!topicsByFolder[key]) topicsByFolder[key] = []
      topicsByFolder[key].push(c)
    })
    const weeks = (byParent.root || [])
      .map((wf) => ({
        folder: wf,
        weekNum: parseInt((String(wf.name || '').match(/\d+/) || [0])[0], 10) || 0,
        children: (byParent[wf.id] || [])
          .map((af) => ({
            folder: af,
            topics: topicsByFolder[af.id] || [],
          }))
          .sort((a, b) => a.folder.name.localeCompare(b.folder.name)),
      }))
      .sort((a, b) => b.weekNum - a.weekNum)
    const orphanTopics = (consignes || []).filter((c) => !folderMap.has(c.dossier_id))
    if (orphanTopics.length > 0) {
      weeks.unshift({
        folder: { id: '__sans_dossier__', name: 'Sans dossier' },
        weekNum: -1,
        children: [{ folder: { id: '__sans_dossier__', name: 'Sans dossier' }, topics: orphanTopics }],
      })
    }
    return weeks
  }, [folders, consignes])

  const totalSujets = consignes?.length || 0

  const toggleFolder = (id) => {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  const openNewTopic = (dossierId) => {
    setIsNew(true)
    setEditingId(null)
    setDraftDossierId(dossierId)
    setEditTitre('')
    setEditCouleur(PALETTE[0])
    setEditContenu('')
    setEditContenuHtml('')
    setSaveError('')
  }

  const openEdit = (c) => {
    setIsNew(false)
    setEditingId(c.id)
    setDraftDossierId(c.dossier_id)
    setEditTitre(c.titre)
    setEditCouleur(c.couleur || PALETTE[0])
    setEditContenu('')
    setEditContenuHtml('')
    setSaveError('')
  }

  const closeModal = () => {
    setEditingId(null)
    setIsNew(false)
    setSaveError('')
  }

  const saveSubject = async () => {
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
          draftDossierId,
          titre,
          editCouleur,
          editContenu,
          editContenuHtml,
          activeProfile?.name || '',
          myKey
        )
        closeModal()
        await loadAll(false)
        if (res?.id) {
          setSelectedId(res.id)
          if (draftDossierId) setExpanded((prev) => (prev.includes(draftDossierId) ? prev : [...prev, draftDossierId]))
        }
      } else if (editingId) {
        await profileStore.saveConsigne(editingId, titre, editCouleur, activeProfile?.name || '')
        closeModal()
        await loadAll(false)
      }
    } catch {
      setSaveError('Échec de l’enregistrement (hors ligne ?).')
    }
    setSaving(false)
  }

  const removeSubject = async (c) => {
    if (!window.confirm(`Supprimer le sujet « ${c.titre} » et toute sa conversation ? Cette action est irréversible.`)) return
    try {
      await profileStore.deleteConsigne(c.id)
      if (selectedId === c.id) setSelectedId(null)
      await loadAll(false)
    } catch {
      setError("Impossible de supprimer le sujet (hors ligne ?).")
    }
  }

  // Dossiers
  const openFolderModal = (mode, folder) => {
    setFolderModal({ mode, folder: folder || null })
    setFolderName(folder ? folder.name : '')
    setFolderError('')
  }

  const saveFolder = async () => {
    const name = folderName.trim()
    if (!name) {
      setFolderError('Le nom du dossier est obligatoire.')
      return
    }
    setFolderSaving(true)
    setFolderError('')
    try {
      if (folderModal.mode === 'new') {
        const res = await profileStore.addFolder(
          folderModal.folder ? folderModal.folder.id : null,
          name,
          activeProfile?.name || ''
        )
        await loadAll(false)
        if (res?.id) setExpanded((prev) => [...prev, res.id])
      } else if (folderModal.folder) {
        await profileStore.renameFolder(folderModal.folder.id, name)
        await loadAll(false)
      }
      setFolderModal(null)
    } catch {
      setFolderError('Échec de l’enregistrement (hors ligne ?).')
    }
    setFolderSaving(false)
  }

  const removeFolder = async (folder) => {
    const isWeek = !folder.parent_id
    if (
      !window.confirm(
        `Supprimer le dossier « ${folder.name} » ?` +
          (isWeek
            ? '\n\nTous ses sous-dossiers et leurs sujets seront supprimés.'
            : '\n\nTous les sujets qu’il contient seront supprimés.') +
          '\nCette action est irréversible.'
      )
    ) {
      return
    }
    try {
      await profileStore.deleteFolder(folder.id)
      if (selectedId) {
        const topic = consignes?.find((c) => c.id === selectedId)
        if (topic?.dossier_id === folder.id || (!isWeek && topic?.dossier_id === folder.id)) {
          setSelectedId(null)
        }
      }
      setExpanded((prev) => prev.filter((f) => f !== folder.id))
      await loadAll(false)
    } catch {
      setError("Impossible de supprimer le dossier (hors ligne ?).")
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
    setReplyPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))])
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
      await loadAll(false)
    } catch {
      setReplyError('Échec de l’envoi (hors ligne ? photo trop lourde ?).')
    }
    setSending(false)
  }

  const modalOpen = isNew || editingId !== null
  const selected = consignes?.find((c) => c.id === selectedId) || null
  const canSend = !sending && (replyText !== '' || replyFiles.length > 0)

  // Chemin du dossier du sujet sélectionné
  const selectedPath = useMemo(() => {
    if (!selected || !folders) return ''
    const folderMap = new Map(folders.map((f) => [f.id, f]))
    const af = folderMap.get(selected.dossier_id)
    if (!af) return 'Sans dossier'
    const wf = af.parent_id ? folderMap.get(af.parent_id) : null
    return wf ? `${wf.name} / ${af.name}` : af.name
  }, [selected, folders])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Consignes</h1>
        <p className="text-slate-600 mt-1">
          Dossiers partagés entre tous les profils — ouvrez un dossier pour accéder à ses sujets.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Arborescence des dossiers */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => openFolderModal('new', null)}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 text-sm font-semibold"
              title="Créer un dossier semaine (ex : Semaine 37)"
            >
              <FolderPlus className="h-4 w-4" /> Dossier semaine
            </button>
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {folders === null && !error && <p className="text-sm text-slate-400 p-4">Chargement…</p>}
            {folders && folders.length === 0 && (
              <p className="text-sm text-slate-500 p-4">
                Aucun dossier. Créez un dossier semaine (ex : « Semaine 37 »), puis ajoutez-y des
                sous-dossiers par immatriculation d'avion.
              </p>
            )}
            {tree.map(({ folder: wf, children }) => {
              const weekOpen = expanded.includes(wf.id)
              const weekCount = children.reduce((acc, c) => acc + c.topics.length, 0)
              return (
                <div key={wf.id}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 text-sm border-b border-slate-100 transition-colors ${
                      weekOpen ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => toggleFolder(wf.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      title={weekOpen ? `Replier « ${wf.name} »` : `Ouvrir « ${wf.name} »`}
                    >
                      {weekOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      {weekOpen ? (
                        <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <span className={`truncate ${weekOpen ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {wf.name}
                      </span>
                      <span className="ml-auto text-xs text-slate-400 shrink-0 pr-1">
                        {children.length} av.{weekCount > 0 ? ` · ${weekCount} suj.` : ''}
                      </span>
                    </button>
                    {!wf.id.startsWith('__') && (
                      <>
                        <button
                          onClick={() => openFolderModal('new', wf)}
                          className="text-slate-400 hover:text-sky-600 p-1 shrink-0"
                          title={`Ajouter un sous-dossier (avion) dans « ${wf.name} »`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openFolderModal('rename', wf)}
                          className="text-slate-400 hover:text-sky-600 p-1 shrink-0"
                          title={`Renommer « ${wf.name} »`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeFolder(wf)}
                          className="text-slate-400 hover:text-red-600 p-1 shrink-0"
                          title={`Supprimer « ${wf.name} »`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {weekOpen &&
                    children.map(({ folder: af, topics }) => {
                      const avOpen = expanded.includes(af.id)
                      return (
                        <div key={af.id}>
                          <div className="pl-9 pr-2 flex items-center gap-2 border-b border-slate-50 bg-slate-50/60">
                            <button
                              onClick={() => toggleFolder(af.id)}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left py-2"
                              title={avOpen ? `Replier « ${af.name} »` : `Ouvrir « ${af.name} »`}
                            >
                              {avOpen ? (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              )}
                              <Plane className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                              <span className={`truncate text-xs font-bold ${avOpen ? 'text-slate-900' : 'text-slate-600'}`}>
                                {af.name}
                              </span>
                              <span className="ml-auto text-xs text-slate-400 shrink-0">
                                {topics.length}
                              </span>
                            </button>
                            {!af.id.startsWith('__') && (
                              <>
                                <button
                                  onClick={() => openNewTopic(af.id)}
                                  className="text-slate-400 hover:text-sky-600 p-1 shrink-0"
                                  title={`Nouveau sujet dans « ${af.name} »`}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openFolderModal('rename', af)}
                                  className="text-slate-400 hover:text-sky-600 p-1 shrink-0"
                                  title={`Renommer « ${af.name} »`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => removeFolder(af)}
                                  className="text-slate-400 hover:text-red-600 p-1 shrink-0"
                                  title={`Supprimer « ${af.name} »`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                          {avOpen &&
                            topics.map((c) => {
                              const active = c.id === selectedId
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setSelectedId(c.id)}
                                  className={`w-full flex items-center gap-2 px-4 pl-12 py-2 text-left text-sm border-b border-slate-50 transition-colors ${
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
                      )
                    })}
                </div>
              )
            })}
            {totalSujets > 0 && (
              <p className="text-[11px] text-slate-400 px-4 py-2">
                {totalSujets} sujet{totalSujets > 1 ? 's' : ''} au total
              </p>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-xl shadow flex flex-col min-h-[420px]">
          {!selected && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
              <MessageSquare className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm">
                {totalSujets > 0
                  ? 'Ouvrez un dossier, puis un sujet pour lire sa conversation.'
                  : 'Créez un dossier semaine, un sous-dossier avion, puis un sujet.'}
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
                    <span className="font-semibold">{selectedPath}</span> ·{' '}
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
                    onClick={() => removeSubject(selected)}
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

      {/* Modale sujet */}
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
                  onClick={saveSubject}
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

      {/* Modale dossier */}
      {folderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setFolderModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-900 text-white rounded-t-xl">
              <h2 className="font-bold">
                {folderModal.mode === 'new'
                  ? folderModal.folder
                    ? 'Nouveau sous-dossier (avion)'
                    : 'Nouveau dossier semaine'
                  : 'Renommer le dossier'}
              </h2>
              <button
                onClick={() => setFolderModal(null)}
                className="text-slate-400 hover:text-white p-1"
                title="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {folderModal.folder ? 'Immatriculation ou nom du dossier' : 'Nom de la semaine'}
                </label>
                <input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder={folderModal.folder ? 'Ex : F-GKXT' : 'Ex : Semaine 37'}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              {folderError && <p className="text-sm text-red-600">{folderError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setFolderModal(null)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={saveFolder}
                  disabled={folderSaving}
                  className="flex items-center gap-1.5 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
                >
                  <Check className="h-4 w-4" />
                  {folderSaving ? 'Enregistrement…' : folderModal.mode === 'rename' ? 'Renommer' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}