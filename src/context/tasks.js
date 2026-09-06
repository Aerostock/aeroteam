import { dedupeAndMerge } from '../utils/helpers'

export function taskActions({ tasks, setTasks, setAssignments }) {
  const addTasks = (newTasks) => {
    setTasks((prev) => dedupeAndMerge(prev, newTasks))
  }

  const assignTask = (taskId, teamId) => {
    setAssignments((prev) => ({ ...prev, [taskId]: teamId }))
  }

  const unassignTask = (taskId) => {
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }

  const removeTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setAssignments((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }

  const removeTasksByBlock = (block) => {
    const idsToRemove = tasks.filter((t) => t.taskType === block).map((t) => t.id)
    setTasks((prev) => prev.filter((t) => t.taskType !== block))
    setAssignments((prev) => {
      const next = { ...prev }
      idsToRemove.forEach((id) => delete next[id])
      return next
    })
  }

  return { addTasks, assignTask, unassignTask, removeTask, removeTasksByBlock }
}