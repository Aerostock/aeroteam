import * as XLSX from 'xlsx'

export function exportToExcel({ tasks, teams, assignments }) {
  const wsData = [
    ['N°', 'Tâche', 'Zone', 'Bloc', 'Skills', 'Heures prévues', 'Statut', 'Appareil', 'Équipe', 'Membres'],
  ]

  const sorted = [...tasks].sort((a, b) => {
    const zoneA = a.workArea || ''
    const zoneB = b.workArea || ''
    if (zoneA !== zoneB) return zoneA.localeCompare(zoneB)
    const blockA = a.taskType || ''
    const blockB = b.taskType || ''
    return blockA.localeCompare(blockB)
  })

  sorted.forEach((task) => {
    const teamId = assignments[task.id]
    const team = teams.find((t) => t.id === teamId)
    wsData.push([
      task.seq ?? '',
      task.description ?? '',
      task.workArea ?? '',
      task.taskType ?? '',
      task.skills ?? '',
      task.scheduledHours ?? '',
      task.mtxStatus ?? '',
      task.registration ?? '',
      team?.name ?? 'Non assignée',
      team?.members?.join(', ') ?? '',
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const colWidths = [6, 55, 22, 10, 18, 12, 10, 12, 20, 40]
  ws['!cols'] = colWidths.map((wch) => ({ wch }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Affectations')

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `affectations-${date}.xlsx`)
}

export function exportTeamsJSON({ teams, assignments, tasks }) {
  const zonesSorted = [...new Set(tasks.map((t) => t.workArea || 'Autre'))].sort()
  const data = {
    zones: zonesSorted.map((zone) => ({
      zone,
      tasks: tasks
        .filter((t) => (t.workArea || 'Autre') === zone)
        .map((t) => ({
          seq: t.seq,
          description: t.description,
          taskType: t.taskType,
          skills: t.skills,
          mtxStatus: t.mtxStatus,
          scheduledHours: t.scheduledHours,
          registration: t.registration,
          team: teams.find((tm) => assignments[t.id] === tm.id)?.name || 'Non assignée',
        })),
    })),
    teams: teams.map((team) => ({
      name: team.name,
      members: team.members,
      tasks: tasks
        .filter((t) => assignments[t.id] === team.id)
        .map((t) => ({
          seq: t.seq,
          description: t.description,
          taskType: t.taskType,
          skills: t.skills,
          workArea: t.workArea,
          scheduledHours: t.scheduledHours,
          registration: t.registration,
        })),
    })),
    unassigned: tasks
      .filter((t) => !assignments[t.id])
      .map((t) => ({
        seq: t.seq,
        description: t.description,
        taskType: t.taskType,
        skills: t.skills,
        workArea: t.workArea,
        scheduledHours: t.scheduledHours,
        registration: t.registration,
      })),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `planning-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
