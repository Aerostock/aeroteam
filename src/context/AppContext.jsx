import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as profileStore from '../lib/profileStore'

const AppContext = createContext(null)

const ACTIVE_CODE_KEY = 'maintenance-app-active-code'

function loadActiveCode() {
  try {
    return localStorage.getItem(ACTIVE_CODE_KEY) || ''
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

const DEFAULT_EMPTY = { tasks: [], teams: [], assignments: {}, members: [] }

export function AppProvider({ children }) {
  const [code, setCode] = useState(loadActiveCode)
  const [activeProfile, setActiveProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [tasks, setTasks] = useState([])
  const [teams, setTeams] = useState([])
  const [assignments, setAssignments] = useState({})
  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)

  const saveTimer = useRef(null)
  const isConnected = !!code && !!activeProfile

  // Charger le profil + ses données depuis Supabase quand le code change
  useEffect(() => {
    if (!code) {
      setActiveProfile(null)
      setTasks([])
      setTeams([])
      setAssignments({})
      setMembers([])
      setLoaded(false)
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
        setLoaded(true)
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
      profileStore
        .saveProfileData(code, { tasks, teams, assignments, members })
        .catch((err) => console.error('Sauvegarde Supabase échouée', err))
    }, 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [isConnected, loaded, code, tasks, teams, assignments, members])

  const connectProfile = useCallback(async (profileCode) => {
    const c = String(profileCode || '').trim()
    if (!c) return { ok: false, error: 'Veuillez saisir un code.' }
    const exists = await profileStore.profileExists(c)
    if (!exists) return { ok: false, error: 'Aucun profil ne correspond à ce code.' }
    localStorage.setItem(ACTIVE_CODE_KEY, c)
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
    setCode('')
    setActiveProfile(null)
    setTasks([])
    setTeams([])
    setAssignments({})
    setMembers([])
    setLoaded(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
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
    setTasks((prev) => {
      const existingSeqs = new Set(prev.map((t) => t.seq).filter((s) => s !== undefined && s !== ''))
      const existingIds = new Set(prev.map((t) => t.id))
      const fresh = newTasks
        .filter((t) => !existingIds.has(t.id))
        .filter((t) => {
          if (t.seq === undefined || t.seq === '') return true
          return !existingSeqs.has(t.seq)
        })
        .map((t, i) => ({
          ...t,
          id: t.id || `${Date.now()}-${i}`,
        }))
      return [...prev, ...fresh]
    })
  }, [])

  const addTeam = useCallback((team) => {
    setTeams((prev) => [...prev, { ...team, id: `team-${Date.now()}` }])
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

  const removeTasksByBlock = useCallback((block) => {
    setTasks((prev) => {
      const idsToRemove = prev.filter((t) => t.taskType === block).map((t) => t.id)
      setAssignments((prevAssign) => {
        const next = { ...prevAssign }
        idsToRemove.forEach((id) => delete next[id])
        return next
      })
      return prev.filter((t) => t.taskType !== block)
    })
  }, [])

  const resetData = useCallback(() => {
    setTasks([])
    setTeams([])
    setAssignments({})
    setMembers([])
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
    tasks, teams, assignments, members,
    activeProfile, code,
    loading, error,
    connectProfile, createProfile, disconnect, deleteProfile,
    addTasks, addTeam, updateTeam, removeTeam, assignTask, unassignTask,
    removeTask, removeTasksByBlock, addMember, addMembers, removeMember, resetData,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp doit être utilisé dans AppProvider')
  return ctx
}
