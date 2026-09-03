import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const AppContext = createContext(null)

const PROFILES_KEY = 'maintenance-app-profiles'
const ACTIVE_KEY = 'maintenance-app-active-profile'

function dataKey(profileId) {
  return `maintenance-app-data-${profileId}`
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function loadActive() {
  try {
    return localStorage.getItem(ACTIVE_KEY) || ''
  } catch (e) {
    return ''
  }
}

function loadData(profileId) {
  if (!profileId) return null
  try {
    const raw = localStorage.getItem(dataKey(profileId))
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
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

const MEMBERS_FILE = [
  'Mr RAPHAEL ALEXIA',
  'Mr FARID AYAD',
  'Mr DOUNDOUJI BA',
  'Mr KESHAV SHARMA BHUJOO',
  'Mr CHARLES EKPIDI',
  'Mr JOHNNY GOBLAS',
  'Mme LOLA JEDOROWICZ',
  'Mr LEE KHELILIFI',
  'Mr ARTHUR LACHAUD',
  'Mr LAURENT LAMBERT',
  'Mr XAVIER LAURIER',
  'Mr WILLIAM LEGER',
  'Mr MATHIEU MICHOUX',
  'Mr NICOLAS RAFFIN',
  'Mr CORENTIN STROJNA',
  'Mr BASILE MESSAN KOKOU ADJETEY-ADJEVI',
  'Mr RICHARD BRULEY',
  'Mme LEA DAMAGNEZ',
  'Mr BRUNO DIAS',
  'Mr CHARLY ELISE',
  'Mr FABRICE FORESTIER',
  'Mr JOEL GARCIA',
  'Mr VINCENT LABARTHE',
  'Mr THIBAULT LIGNOUX',
  'Mr JONATHAN MIGUEL',
  'Mr WALID OUKI',
  'Mr OLIVIER PARIZOT',
  'Mr STEEVEN PREVOST',
  'Mr FABRICE SAUCE',
  'Mr NICOLAS ZITTE',
]

// Migration unique : injecte les membres du fichier dans les profils EXISTANTS.
// Le flag enregistre les IDs des profils DÉJÀ traités, afin que les FUTURS profils
// ne soient pas concernés, tout en permettant de traiter des profils existants
// même si aucun profil n'existait à un chargement précédent.
const SEED_MEMBERS_FLAG = 'maintenance-app-seeded-members'

function loadSeeded() {
  try {
    const raw = localStorage.getItem(SEED_MEMBERS_FLAG)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

function seedMembersOnce() {
  const seeded = loadSeeded()
  const profiles = loadProfiles()
  const updated = [...seeded]
  profiles.forEach((profile) => {
    if (seeded.includes(profile.id)) return
    const key = dataKey(profile.id)
    let data = {}
    try {
      data = JSON.parse(localStorage.getItem(key) || '{}')
    } catch (e) {
      data = {}
    }
    const merged = [...new Set([...(data.members || []), ...MEMBERS_FILE])]
    data.members = merged
    localStorage.setItem(key, JSON.stringify(data))
    updated.push(profile.id)
  })
  if (updated.length) {
    localStorage.setItem(SEED_MEMBERS_FLAG, JSON.stringify(updated))
  }
}

export function AppProvider({ children }) {
  const [profiles, setProfiles] = useState(loadProfiles)
  const [activeProfileId, setActiveProfileId] = useState(loadActive)

  const [tasks, setTasks] = useState([])
  const [teams, setTeams] = useState([])
  const [assignments, setAssignments] = useState({})
  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null

  // Injection unique des membres dans les profils existants (au premier lancement uniquement)
  useEffect(() => {
    seedMembersOnce()
  }, [])

  // Charger les données du profil actif
  useEffect(() => {
    setLoaded(false)
    setTasks([])
    setTeams([])
    setAssignments({})
    setMembers([])
    const data = loadData(activeProfileId) || DEFAULT_EMPTY
    setTasks(dedupeTasks(data.tasks || []))
    setTeams(data.teams || [])
    setAssignments(data.assignments || {})
    setMembers(data.members || [])
    setLoaded(true)
  }, [activeProfileId])

  // Sauvegarder les données du profil actif (uniquement une fois chargées)
  useEffect(() => {
    if (!activeProfileId || !loaded) return
    localStorage.setItem(
      dataKey(activeProfileId),
      JSON.stringify({ tasks, teams, assignments, members })
    )
  }, [activeProfileId, tasks, teams, assignments, members, loaded])

  const setActiveProfile = useCallback((id) => {
    setActiveProfileId(id)
    localStorage.setItem(ACTIVE_KEY, id)
  }, [])

  const createProfile = useCallback((name, aircraft) => {
    const id = `profile-${Date.now()}`
    const newProfiles = [...profiles, { id, name: String(name).trim(), aircraft: String(aircraft).trim() }]
    setProfiles(newProfiles)
    localStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles))
    // initialise des données vides pour ce profil
    localStorage.setItem(dataKey(id), JSON.stringify(DEFAULT_EMPTY))
    return id
  }, [profiles])

  const deleteProfile = useCallback(
    (id) => {
      const remaining = profiles.filter((p) => p.id !== id)
      setProfiles(remaining)
      localStorage.setItem(PROFILES_KEY, JSON.stringify(remaining))
      localStorage.removeItem(dataKey(id))
      if (activeProfileId === id) {
        setActiveProfileId('')
        localStorage.removeItem(ACTIVE_KEY)
      }
    },
    [profiles, activeProfileId]
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
    if (activeProfileId) {
      localStorage.setItem(dataKey(activeProfileId), JSON.stringify(DEFAULT_EMPTY))
    }
  }, [activeProfileId])

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
    profiles, activeProfile, activeProfileId,
    setActiveProfile, createProfile, deleteProfile,
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
