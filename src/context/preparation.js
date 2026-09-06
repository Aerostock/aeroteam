import { dedupeAndMerge } from '../utils/helpers'

export function prepActions({ setPrepTasks, setPockets }) {
  const addPrepTasks = (newTasks) => {
    setPrepTasks((prev) => dedupeAndMerge(prev, newTasks))
  }

  const removePrepTask = (taskId) => {
    setPrepTasks((prev) => prev.filter((t) => t.id !== taskId))
    setPockets((prev) =>
      prev.map((p) => ({ ...p, taskIds: p.taskIds.filter((id) => id !== taskId) }))
    )
  }

  const removePrepTasksByBlock = (block) => {
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
  }

  const clearPrepTasks = () => {
    setPrepTasks([])
    setPockets([])
  }

  return { addPrepTasks, removePrepTask, removePrepTasksByBlock, clearPrepTasks }
}