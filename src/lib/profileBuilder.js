// Construction/fusion des données de profil avion à partir de l'analyse
// du fichier consignes. Règles :
// - équipes Matin/Soir/Nuit : identifiées par NOM (majuscules/minuscules
//   insensibles), conservées si existantes (membres remplacés, id gardés
//   pour ne pas casser les affectations) ;
// - les autres équipes, tâches et affectations existantes sont conservées ;
// - les consignes sont insérées sous forme de notes préfixées [C] (jolies
//   à la ré-import) ;
// - la liste des membres est l'union des membres de tous les shifts.

import { makeId } from '../utils/helpers'

const SHIFT_TEAM_NAMES = ['matin', 'soir', 'nuit']
const NOTE_PREFIX = '[C] '
const TEAM_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6']

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function shiftMembers(days, shift) {
  const out = []
  Object.values(days || {}).forEach((d) => {
    const arr = d[shift]
    if (Array.isArray(arr)) out.push(...arr)
  })
  return out
}

export function buildProfileData(existing, aircraftInfo, scope) {
  const data = existing || {
    tasks: [],
    teams: [],
    assignments: {},
    members: [],
    prepTasks: [],
    notes: [],
    pockets: [],
  }
  const norm = (n) => String(n || '').trim().toLowerCase()
  const shiftSet = new Set(SHIFT_TEAM_NAMES)

  // Équipes existantes : conservées toutes, SAUF celle du shift visé
  // (en mode scoped) ou les équipes shift (en mode semaine complète)
  // qui sont reconstruites ci-dessous.
  const keptTeams = (data.teams || []).filter((t) => {
    const key = norm(t.name)
    if (scope) return key !== norm(scope.shift)
    return !shiftSet.has(key)
  })

  // Équipes shift : id conservé si l'équipe existe déjà, membres remplacés
  const existingShiftIds = {}
  ;(data.teams || []).forEach((t) => {
    const key = norm(t.name)
    if (shiftSet.has(key)) existingShiftIds[key] = t.id
  })

  const newShiftTeams = SHIFT_TEAM_NAMES.filter((s) => !scope || s === norm(scope.shift)).map(
    (s, idx) => ({
      id: existingShiftIds[s] || `team-${s}-${Date.now()}`,
      name: cap(s),
      members: [...new Set(shiftMembers(aircraftInfo.days, s))],
      color: TEAM_COLORS[idx % TEAM_COLORS.length],
      locked: false,
    })
  )

  // Membres : union (existants + tous les shifts retenus)
  const allShiftMembers = SHIFT_TEAM_NAMES.reduce(
    (acc, s) => acc.concat(shiftMembers(aircraftInfo.days, s)),
    []
  )
  const members = [...new Set([...(data.members || []), ...allShiftMembers])]

  // Notes consignes : en mode semaine, les anciennes [C] sont remplacées ;
  // en mode scoped, seule la note du jour × shift visé est remplacée.
  const NOTE_TITLE = scope
    ? `${NOTE_PREFIX}${String(scope.day || '').toUpperCase()} ${cap(scope.shift)}`
    : null
  const keptNotes = (data.notes || []).filter((n) => {
    const title = String(n.title || '')
    if (scope) return title !== NOTE_TITLE
    return !title.startsWith(NOTE_PREFIX)
  })
  const consigneNotes = []
  Object.entries(aircraftInfo.days || {}).forEach(([day, d]) => {
    Object.entries(d.consignes || {}).forEach(([shift, tasks]) => {
      if (!Array.isArray(tasks) || tasks.length === 0) return
      consigneNotes.push({
        id: makeId('note'),
        title: `${NOTE_PREFIX}${day.toUpperCase()} ${cap(shift)}`,
        content: tasks.map((t) => `- ${t}`).join('\n'),
        createdAt: Date.now(),
      })
    })
  })

  return {
    tasks: data.tasks || [],
    teams: [...keptTeams, ...newShiftTeams],
    assignments: data.assignments || {},
    members,
    prepTasks: data.prepTasks || [],
    notes: [...consigneNotes, ...keptNotes],
    pockets: data.pockets || [],
  }
}

export function aircraftProfileLabel(immat) {
  return `Équipe ${immat}`
}