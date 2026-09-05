import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as profileStore from '../lib/profileStore'
import { dedupeAndMerge, makeId } from '../utils/helpers'

const AppContext = createContext(null)

const ACTIVE_CODE_KEY = 'maintenance-app-active-code'
const ACTIVE_AT_KEY = 'maintenance-app-active-at'
const SESSION_MAX_HOURS = 12
export const ADMIN_CODE = '4172'

function loadActiveCode() {
  try {
    const code = localStorage.getItem(ACTIVE_CODE_KEY) || ''
    const at = localStorage.getItem(ACTIVE_AT_KEY)
    if (!code || !at) return ''
    const hours = (Date.now() - Number(at)) / (1000 * 60 * 60)
    if (hours > SESSION_MAX_HOURS) {
      localStorage.removeItem(ACTIVE_CODE_KEY)
      localStorage.removeItem(ACTIVE_AT_KEY)
      return ''
    }
    return code
  } catch (e) {
    return ''
  }
}

function dedupeTasks(tasks) {
  const seen = new Set()
  const out = []
  tasks.forEach((t) => {
    if (t.seq !== undefined && t.seq !== '') {
      if (seen.has(t.seq)) return
      seen.add(t.seq)
    }
    out.push(t)
  })
  return out
}

const DEFAULT_EMPTY = {
  tasks: [],
  teams: [],
  assignments: {},
  members: [],
  prepTasks: [],
  notes: [],
  pockets: [],
}

export function AppProvider({ children }) {
  const [code, setCode] = useState(loadActiveCode)
  const [activeProfile, setActiveProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [tasks, setTasks] = useState([])
  const [teams, setTeams] = useState([])
  const [assignments, setAssignments] = useState({})
  const [members, setMembers] = useState([])
  const [prepTasks, setPrepTasks] = useState([])
  const [pockets, setPockets] = useState([])
  const [notes, setNotes] = useState([])
  const [loaded, setLoaded] = useState(false)

  const saveTimer = useRef(null)
  const pendingPayload = useRef(null)
  const codeRef = useRef('')
  const revRef = useRef(0)

  useEffect(() => {
    codeRef.current = code
  }, [code])

  const isConnected = !!code && !!activeProfile
  const [saveState, setSaveState] = useState('saved')

  const performSave = useCallback(async (payload, force) => {
    setSaveState('saving')
    try {
      const res = await profileStore.saveProfileData(codeRef.current, payload, revRef.current, force)
      if (res?.error === 'conflict') {
        pendingPayload.current = null
        setSaveState('conflict')
        return
      }
      if (res?.error === 'not_found') {
        pendingPayload.current = payload
        setSaveState('offline')
        return
      }
      revRef.current = res?.rev ?? revRef.current
      pendingPayload.current = null
      setSaveState('saved')
    } catch {
      pendingPayload.current = payload
      setSaveState('offline')
    }
  }, [])

  // Veille de reprise : tant qu'un payload est en attente et qu'on
  // n'est ni hors ligne effectif ni en conflit, on retente toutes les 30 s
  useEffect(() => {
    if (!isConnected || !loaded) return
    const timer = setInterval(() => {
      const payload = pendingPayload.current
      if (payload && saveState === 'offline') {
        performSave(payload, false)
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [isConnected, loaded, saveState, performSave])

  // Charger le profil + ses données depuis Supabase quand le code change
  useEffect(() => {
    if (!code) {
      setActiveProfile(null)
      setTasks([])
      setTeams([])
      setAssignments({})
      setMembers([])
      setPrepTasks([])
      setPockets([])
      setNotes([])
      setLoaded(false)
      setSaveState('saved')
      revRef.current = 0
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    profileStore
      .getProfile(code)
      .then((profile) => {
        if (cancelled) return
        if (!profile) {
          // Le code n'existe pas (profil supprimé sur le cloud) : on déconnecte
          localStorage.removeItem(ACTIVE_CODE_KEY)
          localStorage.removeItem(ACTIVE_AT_KEY)
          setCode('')
          setActiveProfile(null)
          setLoaded(false)
          return
        }
        const data = profile.data || DEFAULT_EMPTY
        setActiveProfile({ id: profile.id, code, name: profile.name, aircraft: profile.aircraft })
        setTasks(dedupeTasks(data.tasks || []))
        setTeams(data.teams || [])
        setAssignments(data.assignments || {})
        setMembers(data.members || [])
        setPrepTasks(data.prepTasks || [])
        setPockets(data.pockets || [])
        setNotes(data.notes || [])
        setLoaded(true)
        revRef.current = profile.rev ?? 0
      })
      .catch((err) => {
        if (cancelled) return
        setError('Impossible de se connecter : ' + (err.message || 'erreur réseau'))
        setLoaded(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [code])

  // Sauvegarde des données dans Supabase (debounce) une fois chargées
  useEffect(() => {
    if (!isConnected || !loaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const payload = { tasks, teams, assignments, members, prepTasks, notes, pockets }
      performSave(payload, false)
    }, 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [isConnected, loaded, code, tasks, teams, assignments, members, prepTasks, notes, pockets, performSave])

  const resolveConflict = useCallback(
    async (mode) => {
      if (mode === 'reload') {
        try {
          const profile = await profileStore.getProfile(codeRef.current)
          if (!profile || profile.error === 'not_found') {
            setSaveState('offline')
            return
          }
          const data = profile.data || DEFAULT_EMPTY
          setTasks(dedupeTasks(data.tasks || []))
          setTeams(data.teams || [])
          setAssignments(data.assignments || {})
          setMembers(data.members || [])
          setPrepTasks(data.prepTasks || [])
          setPockets(data.pockets || [])
          setNotes(data.notes || [])
          revRef.current = profile.rev ?? 0
          pendingPayload.current = null
          setSaveState('saved')
        } catch {
          setSaveState('offline')
        }
      } else {
        const payload = { tasks, teams, assignments, members, prepTasks, notes, pockets }
        await performSave(payload, true)
      }
    },
    [tasks, teams, assignments, members, prepTasks, notes, pockets, performSave]
  )

  const connectProfile = useCallback(async (profileCode) => {
    const c = String(profileCode || '').trim()
    if (!c) return { ok: false, error: 'Veuillez saisir un code.' }
    const exists = await profileStore.profileExists(c)
    if (!exists) return { ok: false, error: 'Aucun profil ne correspond à ce code.' }
    localStorage.setItem(ACTIVE_CODE_KEY, c)
    localStorage.setItem(ACTIVE_AT_KEY, String(Date.now()))
    setCode(c)
    return { ok: true }
  }, [])

  const createProfile = useCallback(
    async ({ code: profileCode, name, aircraft }) => {
      const c = String(profileCode || '').trim()
      if (!c) return { ok: false, error: 'Le code est obligatoire.' }
      if (!name || !String(name).trim()) return { ok: false, error: 'Le nom du profil est obligatoire.' }
      try {
        await profileStore.createProfile(c, String(name).trim(), String(aircraft || '').trim())
        localStorage.setItem(ACTIVE_CODE_KEY, c)
        localStorage.setItem(ACTIVE_AT_KEY, String(Date.now()))
        setCode(c)
        return { ok: true }
      } catch (err) {
        if (err.message === 'code_exists') {
          return { ok: false, error: 'Ce code est déjà utilisé. Choisissez un autre code.' }
        }
        return { ok: false, error: 'Échec de la création : ' + (err.message || 'erreur réseau') }
      }
    },
    []
  )

  const disconnect = useCallback(() => {
    localStorage.removeItem(ACTIVE_CODE_KEY)
    localStorage.removeItem(ACTIVE_AT_KEY)
    setCode('')
    setActiveProfile(null)
    setTasks([])
    setTeams([])
    setAssignments({})
    setMembers([])
    setPrepTasks([])
    setPockets([])
    setNotes([])
    setLoaded(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    pendingPayload.current = null
    revRef.current = 0
    setSaveState('saved')
  }, [])

  const deleteProfile = useCallback(
    async (profileCode) => {
      const target = profileCode || code
      if (!target) return { ok: false }
      try {
        await profileStore.deleteProfile(target)
        if (isConnected && target === code) {
          disconnect()
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    },
    [code, isConnected, disconnect]
  )

  const addTasks = useCallback((newTasks) => {
    setTasks((prev) => dedupeAndMerge(prev, newTasks))
  }, [])

  const addTeam = useCallback((team) => {
    setTeams((prev) => [...prev, { ...team, id: makeId('team') }])
  }, [])

  const updateTeam = useCallback((id, updates) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }, [])

  const removeTeam = useCallback((id) => {
    setTeams((prev) => prev.filter((t) => t.id !== id))
    setAssignments((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((k) => {
        if (next[k] === id) delete next[k]
      })
      return next
    })
  }, [])

  const assignTask = useCallback((taskId, teamId) => {
    setAssignments((prev) => ({ ...prev, [taskId]: teamId }))
  }, [])

  const unassignTask = useCallback((taskId) => {
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }, [])

  const removeTask = useCallback((taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }, [])

  const removeTasksByBlock = useCallback(
    (block) => {
      const idsToRemove = tasks.filter((t) => t.taskType === block).map((t) => t.id)
      setTasks((prev) => prev.filter((t) => t.taskType !== block))
      setAssignments((prev) => {
        const next = { ...prev }
        idsToRemove.forEach((id) => delete next[id])
        return next
      })
    },
    [tasks]
  )

  const resetData = useCallback(() => {
    setTasks([])
    setTeams([])
    setAssignments({})
    setPrepTasks([])
    setPockets([])
  }, [])

  const addPrepTasks = useCallback((newTasks) => {
    setPrepTasks((prev) => dedupeAndMerge(prev, newTasks))
  }, [])

  const removePrepTask = useCallback((taskId) => {
    setPrepTasks((prev) => prev.filter((t) => t.id !== taskId))
    setPockets((prev) =>
      prev.map((p) => ({ ...p, taskIds: p.taskIds.filter((id) => id !== taskId) }))
    )
  }, [])

  const removePrepTasksByBlock = useCallback((block) => {
    setPrepTasks((prev) => {
      const removedIds = prev.filter((t) => t.taskType === block).map((t) => t.id)
      setPockets((prevPockets) =>
        prevPockets.map((p) => ({
          ...p,
          taskIds: p.taskIds.filter((id) => !removedIds.includes(id)),
        }))
      )
      return prev.filter((t) => t.taskType !== block)
    })
  }, [])

  const clearPrepTasks = useCallback(() => {
    setPrepTasks([])
    setPockets([])
  }, [])

  const addPocket = useCallback((name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return null
    const id = makeId('pocket')
    setPockets((prev) => [
      ...prev,
      { id, name: trimmed, taskIds: [], createdAt: Date.now() },
    ])
    return id
  }, [])

  const renamePocket = useCallback((pocketId, name) => {
    const trimmed = String(name || '').trim()
    setPockets((prev) =>
      prev.map((p) => (p.id === pocketId ? { ...p, name: trimmed || p.name } : p))
    )
  }, [])

  const addTasksToPocket = useCallback((pocketId, taskIds) => {
    const ids = [...new Set(taskIds)]
    setPockets((prev) =>
      prev.map((p) =>
        p.id === pocketId
          ? { ...p, taskIds: [...new Set([...p.taskIds, ...ids])] }
          : p
      )
    )
  }, [])

  const removeTasksFromPocket = useCallback((pocketId, taskIds) => {
    const ids = new Set(taskIds)
    setPockets((prev) =>
      prev.map((p) =>
        p.id === pocketId ? { ...p, taskIds: p.taskIds.filter((id) => !ids.has(id)) } : p
      )
    )
  }, [])

  const removePocket = useCallback((pocketId) => {
    setPockets((prev) => prev.filter((p) => p.id !== pocketId))
  }, [])

  const addNote = useCallback((title, content) => {
    setNotes((prev) => [
      { id: makeId('note'), title, content, createdAt: Date.now() },
      ...prev,
    ])
  }, [])

  const updateNote = useCallback((id, updates) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)))
  }, [])

  const removeNote = useCallback((id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const addMember = useCallback((name) => {
    const trimmed = String(name).trim()
    if (!trimmed) return
    setMembers((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }, [])

  const addMembers = useCallback((names) => {
    setMembers((prev) => {
      const next = [...prev]
      names.forEach((n) => {
        const trimmed = String(n).trim()
        if (trimmed && !next.includes(trimmed)) next.push(trimmed)
      })
      return next
    })
  }, [])

  const removeMember = useCallback((name) => {
    setMembers((prev) => prev.filter((m) => m !== name))
    setTeams((prev) =>
      prev.map((t) =>
        t.members.includes(name) ? { ...t, members: t.members.filter((m) => m !== name) } : t
      )
    )
  }, [])

const value = {
    tasks, teams, assignments, members, prepTasks, notes, pockets,
    activeProfile, code, isAdmin: code === ADMIN_CODE,
    loading, error, saveState, resolveConflict,
    connectProfile, createProfile, disconnect, deleteProfile,
    addTasks, addTeam, updateTeam, removeTeam, assignTask, unassignTask,
    removeTask, removeTasksByBlock, addMember, addMembers, removeMember, resetData,
    addPrepTasks, removePrepTask, removePrepTasksByBlock, clearPrepTasks,
    addPocket, renamePocket, addTasksToPocket, removeTasksFromPocket, removePocket,
    addNote, updateNote, removeNote,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp doit être utilisé dans AppProvider')
  return ctx
}
