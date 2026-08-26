import Dexie, { type EntityTable } from 'dexie'
import type { Notation } from '../engine'
import type {
  CircuitDocument,
  CustomChipDefinition,
  TestbenchDocument,
} from '../circuit'
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

export type NewCircuitProject = Omit<
  CircuitProject,
  'id' | 'createdAt' | 'updatedAt'
>

/** Um testbench declarativo salvo localmente e associado a um circuito. */
export interface TestbenchProject {
  id: number
  circuitId: number
  name: string
  document: TestbenchDocument
  createdAt: number
  updatedAt: number
}

export type NewTestbenchProject = Omit<
  TestbenchProject,
  'id' | 'createdAt' | 'updatedAt'
>

/** Um algoritmo de fluxograma salvo localmente. */
export interface AlgorithmProject {
  id: number
  name: string
  document: AlgorithmDocument
  createdAt: number
  updatedAt: number
}

export type NewAlgorithmProject = Omit<
  AlgorithmProject,
  'id' | 'createdAt' | 'updatedAt'
>

/** Uma definição de chip customizado criada a partir de um circuito local. */
export interface CustomChipProject {
  id: number
  name: string
  definition: CustomChipDefinition
  createdAt: number
  updatedAt: number
}

export type NewCustomChipProject = Omit<
  CustomChipProject,
  'id' | 'createdAt' | 'updatedAt'
>

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
  customChipProjects!: EntityTable<CustomChipProject, 'id'>
  testbenchProjects!: EntityTable<TestbenchProject, 'id'>

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
    this.version(4).stores({
      projects: '++id, name, updatedAt',
      circuitProjects: '++id, name, updatedAt',
      algorithmProjects: '++id, name, updatedAt',
      customChipProjects: '++id, name, updatedAt',
    })
    this.version(5).stores({
      projects: '++id, name, updatedAt',
      circuitProjects: '++id, name, updatedAt',
      algorithmProjects: '++id, name, updatedAt',
      customChipProjects: '++id, name, updatedAt',
      testbenchProjects: '++id, circuitId, name, updatedAt',
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
