import { describe, it, expect } from 'vitest'
import { buildProfileData, aircraftProfileLabel } from './profileBuilder'

const aircraftInfo = {
  immat: 'F-GSQB',
  totalTasks: 5,
  days: {
    LUNDI: {
      matin: ['AYAD (FARID)'],
      soir: ['DIAS (BRUNO)'],
      nuit: ['NICOLAS (ALEXANDRE)'],
      consignes: {
        matin: ['LEADER + ACL + IDT', 'CAB SECU'],
        soir: ['LEADER INSP LAVATORIES'],
        nuit: ['WASTE'],
      },
    },
    MARDI: {
      matin: ['AYAD (FARID)', 'DUPONT (JEAN)'],
      consignes: { matin: ['DESCALING'] },
    },
  },
}

describe('buildProfileData', () => {
  it('crée les équipes Matin/Soir/Nuit avec l\'union des membres', () => {
    const data = buildProfileData(null, aircraftInfo)
    expect(data.teams.map((t) => t.name)).toEqual(['Matin', 'Soir', 'Nuit'])
    const matin = data.teams.find((t) => t.name === 'Matin')
    expect(matin.members).toEqual(['AYAD (FARID)', 'DUPONT (JEAN)'])
    expect(data.teams.find((t) => t.name === 'Soir').members).toEqual(['DIAS (BRUNO)'])
    expect(data.members.sort()).toEqual(
      ['AYAD (FARID)', 'DUPONT (JEAN)', 'DIAS (BRUNO)', 'NICOLAS (ALEXANDRE)'].sort()
    )
  })

  it('insère les consignes en notes [C] par jour × shift', () => {
    const data = buildProfileData(null, aircraftInfo)
    const notes = data.notes.filter((n) => n.title.startsWith('[C] '))
    expect(notes.map((n) => n.title)).toEqual(['[C] LUNDI Matin', '[C] LUNDI Soir', '[C] LUNDI Nuit', '[C] MARDI Matin'])
    expect(notes[0].content).toContain('- LEADER + ACL + IDT')
  })

  it('conserve les équipes existantes et remplace les membres des équipes shift', () => {
    const existing = {
      tasks: [{ id: 't1', description: 'tâche existante' }],
      teams: [
        { id: 'old-1', name: 'Équipe spéciale', members: ['PERSIST (ONE)'], color: '#111111', locked: false },
        { id: 'matin-1', name: 'Matin', members: ['ANCIEN (A)'], color: '#0ea5e9', locked: false },
      ],
      assignments: { t1: 'matin-1' },
      members: ['PERSIST (ONE)'],
      prepTasks: [],
      notes: [{ id: 'n1', title: '[C] LUNDI Soir', content: 'ancienne consigne' }],
      pockets: [],
    }
    const data = buildProfileData(existing, aircraftInfo)
    expect(data.teams.map((t) => t.id)).toContain('old-1')
    const matin = data.teams.find((t) => t.id === 'matin-1')
    expect(matin.name).toBe('Matin')
    expect(matin.members).toEqual(['AYAD (FARID)', 'DUPONT (JEAN)'])
    const notes = data.notes.filter((n) => n.title.startsWith('[C] '))
    expect(notes.some((n) => n.title === '[C] LUNDI Soir' && n.content.includes('LEADER INSP LAVATORIES'))).toBe(true)
    expect(notes.some((n) => n.content.includes('ancienne consigne'))).toBe(false)
    // Les affectations restent intactes
    expect(data.assignments.t1).toBe('matin-1')
    expect(data.tasks).toHaveLength(1)
  })
})

describe('aircraftProfileLabel', () => {
  it('nomme le profil pour un avion', () => {
    expect(aircraftProfileLabel('F-GSQB')).toBe('Équipe F-GSQB')
  })
})