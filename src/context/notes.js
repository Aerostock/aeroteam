import { makeId } from '../utils/helpers'

export function noteActions({ setNotes }) {
  const addNote = (title, content) => {
    setNotes((prev) => [
      { id: makeId('note'), title, content, createdAt: Date.now() },
      ...prev,
    ])
  }

  const updateNote = (id, updates) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)))
  }

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  return { addNote, updateNote, removeNote }
}