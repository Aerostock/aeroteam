import { makeId } from '../utils/helpers'

export function pocketActions({ setPockets }) {
  const addPocket = (name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return null
    const id = makeId('pocket')
    setPockets((prev) => [
      ...prev,
      { id, name: trimmed, taskIds: [], createdAt: Date.now() },
    ])
    return id
  }

  const renamePocket = (pocketId, name) => {
    const trimmed = String(name || '').trim()
    setPockets((prev) =>
      prev.map((p) => (p.id === pocketId ? { ...p, name: trimmed || p.name } : p))
    )
  }

  const addTasksToPocket = (pocketId, taskIds) => {
    const ids = [...new Set(taskIds)]
    setPockets((prev) =>
      prev.map((p) =>
        p.id === pocketId ? { ...p, taskIds: [...new Set([...p.taskIds, ...ids])] } : p
      )
    )
  }

  const removeTasksFromPocket = (pocketId, taskIds) => {
    const ids = new Set(taskIds)
    setPockets((prev) =>
      prev.map((p) =>
        p.id === pocketId ? { ...p, taskIds: p.taskIds.filter((id) => !ids.has(id)) } : p
      )
    )
  }

  const removePocket = (pocketId) => {
    setPockets((prev) => prev.filter((p) => p.id !== pocketId))
  }

  return { addPocket, renamePocket, addTasksToPocket, removeTasksFromPocket, removePocket }
}