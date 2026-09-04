export const CATEGORY_COLORS = {
  JIC: '#0ea5e9',
  CORR: '#f59e0b',
  MPC: '#8b5cf6',
  ADHOC: '#ef4444',
  EO: '#14b8a6',
  AUTRE: '#64748b',
}

export const CATEGORIES = Object.keys(CATEGORY_COLORS)

export const SHIFT_COLORS = {
  'MERCREDI MATIN': '#10b981',
  'MERCREDI SOIR': '#6366f1',
  'MERCREDI NUIT': '#3b82f6',
  'JEUDI MATIN': '#f97316',
  SUB: '#64748b',
  'VAC 06': '#a855f7',
  AUTRE: '#6b7280',
}

// Couleurs attribuées aux zones de travail
export const ZONE_COLORS = [
  '#0ea5e9',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#3b82f6',
  '#84cc16',
  '#ec4899',
  '#06b6d4',
  '#a855f7',
  '#22c55e',
  '#eab308',
  '#f43f5e',
  '#6366f1',
]

export function getZoneColor(zone, allZones) {
  const index = allZones.indexOf(zone)
  return ZONE_COLORS[index % ZONE_COLORS.length]
}

// Filtres configurables pour l'import
export const IMPORT_FILTERS = {
  // Colonne Skills (F) : garder toutes valeurs CABB*
  skills: {
    enabled: true,
    match: (value) => {
      const v = String(value || '').toUpperCase().trim()
      return v.startsWith('CABB')
    },
  },
  // Colonne MTX_Status (G) : garder ACTV et PAUSE
  mtxStatus: {
    enabled: true,
    allowed: ['ACTV', 'PAUSE'],
    match: (value) => {
      const v = String(value || '').toUpperCase().trim()
      return v === 'ACTV' || v === 'PAUSE'
    },
  },
  // Colonne Task_Type (H) : garder tous les blocs
  taskType: {
    enabled: false,
    match: () => true,
  },
}

export function getCategoryColor(category) {
  const key = CATEGORIES.find(
    (c) => category && category.toUpperCase().includes(c)
  )
  return key ? CATEGORY_COLORS[key] : CATEGORY_COLORS.AUTRE
}

export function getShiftColor(shift) {
  const key = Object.keys(SHIFT_COLORS).find(
    (s) => shift && shift.toUpperCase().includes(s)
  )
  return key ? SHIFT_COLORS[key] : SHIFT_COLORS.AUTRE
}

// Extrait le prénom d'un nom complet du type "Mr Farid Ayad" -> "Farid",
// "Mme Lea Damagnez" -> "Lea". Sans civilité, renvoie le premier mot.
export function getFirstName(fullName) {
  const name = String(fullName || '').trim()
  if (!name) return ''
  const parts = name.split(/\s+/)
  if (/^(mr|mme|m\.|mme\.|mrs|ms)\.?$/i.test(parts[0])) {
    return parts[1] || ''
  }
  return parts[0]
}

export function groupTasksByCategory(tasks) {
  return tasks.reduce((acc, task) => {
    const cat = task.taskType || task.category || 'AUTRE'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(task)
    return acc
  }, {})
}

export function groupTasksByField(tasks, field) {
  return tasks.reduce((acc, task) => {
    const key = (task[field] || 'AUTRE').toString().toUpperCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(task)
    return acc
  }, {})
}

export function normalizeHeader(header) {
  if (!header) return ''
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export const HEADER_ALIASES = {
  seq: ['seq._nr.', 'seq', 'n°', 'numero', 'number', 'no', 'ref'],
  description: ['task_name', 'name', 'description', 'libelle', 'intitule'],
  skills: ['skills', 'skill', 'metier'],
  mtxStatus: ['mtx_status', 'status', 'etat'],
  taskType: ['task_type', 'type'],
  workArea: ['work_area', 'area', 'zone'],
  phase: ['phase'],
  shift: ['shift', 'poste'],
  startDate: ['scheduled_start_date', 'start_date', 'debut', 'start'],
  endDate: ['scheduled_end_date', 'end_date', 'fin', 'end'],
  scheduledHours: ['scheduled_hours', 'hours', 'heures', 'duree'],
  actualHours: ['actual_hours'],
  taskCode: ['task_code', 'code'],
  aircraftType: ['aircraft_type', 'aircraft', 'appareil'],
  registration: ['aircraft_registration', 'registration', 'immatriculation', 'immat'],
  partStatus: ['part_status'],
  impact: ['impact'],
  crew: ['crew', 'equipage'],
  material: ['material_availability', 'material'],
  taskSteps: ['task_steps'],
  configSlot: ['config_slot'],
  taskBarcode: ['task_barcode'],
  workBarcode: ['work_package_barcode', 'workpackage'],
  pauseReason: ['pause_reason'],
  pauseNotes: ['pause_notes'],
  technicalZones: ['technical_zones', 'technical_zones'],
  collected: ['collected'],
}

export function detectColumns(headers) {
  const normalized = headers.map(normalizeHeader)
  const detected = {}

  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    const idx = normalized.findIndex((h) => aliases.includes(h))
    if (idx !== -1) detected[field] = idx
  })

  return detected
}

// Filtre les lignes selon les règles d'import
export function filterRow(row, columns) {
  const get = (field) => {
    const idx = columns[field]
    return idx !== undefined ? row[idx] : undefined
  }

  // Filtre Skill (colonne F)
  if (IMPORT_FILTERS.skills.enabled) {
    const skill = get('skills')
    if (!IMPORT_FILTERS.skills.match(skill)) return false
  }

  // Filtre MTX Status (colonne G)
  if (IMPORT_FILTERS.mtxStatus.enabled) {
    const status = get('mtxStatus')
    if (!IMPORT_FILTERS.mtxStatus.match(status)) return false
  }

  // Filtre Task Type (colonne H)
  if (IMPORT_FILTERS.taskType.enabled) {
    const type = get('taskType')
    if (!IMPORT_FILTERS.taskType.match(type)) return false
  }

  return true
}

export function parseExcelRows(rows, columns) {
  const result = []

  rows.forEach((row, _idx) => {
    const get = (field) => {
      const idx = columns[field]
      return idx !== undefined ? row[idx] : undefined
    }

    // Applique les filtres
    if (!filterRow(row, columns)) return

    const description = get('description')
      ? String(get('description'))
      : String(get('taskBarcode') || '')

    if (!description) return

    const task = {
      id: `task-${Date.now()}-${result.length}`,
      seq: get('seq') !== undefined ? String(get('seq')) : undefined,
      description,
      skills: get('skills') ? String(get('skills')) : undefined,
      mtxStatus: get('mtxStatus') ? String(get('mtxStatus')) : undefined,
      taskType: get('taskType') ? String(get('taskType')) : undefined,
      workArea: get('workArea') ? String(get('workArea')) : undefined,
      phase: get('phase') ? String(get('phase')) : undefined,
      shift: get('shift') ? String(get('shift')) : undefined,
      startDate: get('startDate') !== undefined ? String(get('startDate')) : undefined,
      endDate: get('endDate') !== undefined ? String(get('endDate')) : undefined,
      scheduledHours: get('scheduledHours') !== undefined ? String(get('scheduledHours')) : undefined,
      actualHours: get('actualHours') !== undefined ? String(get('actualHours')) : undefined,
      taskCode: get('taskCode') !== undefined ? String(get('taskCode')) : undefined,
      taskBarcode: get('taskBarcode') !== undefined ? String(get('taskBarcode')) : undefined,
      workBarcode: get('workBarcode') !== undefined ? String(get('workBarcode')) : undefined,
      aircraftType: get('aircraftType') ? String(get('aircraftType')) : undefined,
      registration: get('registration') ? String(get('registration')) : undefined,
      partStatus: get('partStatus') ? String(get('partStatus')) : undefined,
      impact: get('impact') ? String(get('impact')) : undefined,
      // Alias compatibilité
      ref: get('seq') !== undefined ? String(get('seq')) : undefined,
      zone: get('workArea') ? String(get('workArea')) : undefined,
      avion: get('registration') ? String(get('registration')) : undefined,
      category: get('taskType') ? String(get('taskType')) : undefined,
    }

    result.push(task)
  })

  return result
}
