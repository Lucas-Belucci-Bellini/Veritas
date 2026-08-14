import Dexie, { type EntityTable } from 'dexie'
import type { Notation } from '../engine'
import type { CircuitDocument } from '../circuit'
import type { AlgorithmDocument } from '../algorithms'

/** Um projeto salvo no navegador do usuário. */
export interface Project {
  id: number
  name: string
  expression: string
  notation: Notation
  createdAt: number
  updatedAt: number
}

export type NewProject = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>

/** Um circuito visual salvo no navegador do usuário. */
export interface CircuitProject {
  id: number
  name: string
  document: CircuitDocument
  createdAt: number
  updatedAt: number
}

export type NewCircuitProject = Omit<CircuitProject, 'id' | 'createdAt' | 'updatedAt'>

/** Um algoritmo de fluxograma salvo localmente. */
export interface AlgorithmProject {
  id: number
  name: string
  document: AlgorithmDocument
  createdAt: number
  updatedAt: number
}

export type NewAlgorithmProject = Omit<AlgorithmProject, 'id' | 'createdAt' | 'updatedAt'>

/**
 * O banco vive no IndexedDB do próprio navegador.
 *
 * Nada sai da máquina do usuário: é o que mantém o projeto gratuito de hospedar
 * e o que vai permitir, na v0.5.0, funcionar sem internet nenhuma.
 */
export class VeritasDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>
  circuitProjects!: EntityTable<CircuitProject, 'id'>
  algorithmProjects!: EntityTable<AlgorithmProject, 'id'>

  constructor(name = 'veritas') {
    super(name)
    this.version(1).stores({ projects: '++id, name, updatedAt' })
    this.version(2).stores({
      projects: '++id, name, updatedAt',
      circuitProjects: '++id, name, updatedAt',
    })
    this.version(3).stores({
      projects: '++id, name, updatedAt',
      circuitProjects: '++id, name, updatedAt',
      algorithmProjects: '++id, name, updatedAt',
    })
  }
}

export const db = new VeritasDatabase()

/** Navegador sem IndexedDB (modo privado em alguns casos) degrada sem quebrar. */
export function storageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}
