import { create } from 'zustand'
import type { PaperSample, PaperSampleInput } from '../types/paper-sample'
import type { SheetRun } from '../types/sheet-run'
import { CURRENT_SCHEMA_REV, db, plain } from '../utils/db'

interface SampleStore {
  paperSamples: PaperSample[]
  isLoading: boolean
  loaded: boolean
  error: string | null
  loadSamples: (force?: boolean) => Promise<void>
  /** 新样本锁定对应工序的规格版本，默认待复检、未归档 */
  addSample: (input: PaperSampleInput, run?: SheetRun) => Promise<PaperSample | null>
  /** 复检通过：解除待复检标记，随后才能归档 */
  markRechecked: (id: number, note: string) => Promise<void>
  /** 归档（仅复检通过后允许） */
  markArchived: (id: number, archiveBin: string) => Promise<void>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useSampleStore = create<SampleStore>((set, get) => ({
  paperSamples: [],
  isLoading: false,
  loaded: false,
  error: null,
  loadSamples: async (force = false) => {
    if (get().loaded && !force) return
    set({ isLoading: true, error: null })
    try {
      const paperSamples = await db.paperSamples.orderBy('sampleNo').toArray()
      set({ paperSamples, isLoading: false, loaded: true })
    } catch {
      set({ isLoading: false, error: '样本档案读取失败，请检查浏览器存储权限' })
    }
  },
  addSample: async (input, run) => {
    set({ error: null })
    try {
      const payload: PaperSample = {
        ...plain(input),
        rechecked: false,
        archived: false,
        specRev: run?.specRev ?? 1,
        schemaRev: CURRENT_SCHEMA_REV,
      }
      const id = Number(await db.paperSamples.add(payload))
      const created: PaperSample = { ...payload, id }
      set((state) => ({ paperSamples: [created, ...state.paperSamples] }))
      return created
    } catch {
      set({ error: '样本登记失败，请检查样本编号是否重复' })
      return null
    }
  },
  markRechecked: async (id, note) => {
    try {
      const recheckNote = note.trim() || `复检通过 ${todayIso()}`
      await db.paperSamples.update(id, { rechecked: true, flaggedByRepairOrderNo: undefined, recheckNote })
      set((state) => ({
        paperSamples: state.paperSamples.map((sample) =>
          sample.id === id
            ? { ...sample, rechecked: true, flaggedByRepairOrderNo: undefined, recheckNote }
            : sample),
        error: null,
      }))
    } catch {
      set({ error: '复检结果保存失败，原记录未改动，可重试' })
    }
  },
  markArchived: async (id, archiveBin) => {
    const existing = get().paperSamples.find((sample) => sample.id === id)
    if (!existing?.rechecked) {
      set({ error: '样本复检通过前不能归档' })
      return
    }
    try {
      await db.paperSamples.update(id, { archived: true, archiveBin })
      set((state) => ({
        paperSamples: state.paperSamples.map((sample) =>
          sample.id === id ? { ...sample, archived: true, archiveBin } : sample),
        error: null,
      }))
    } catch {
      set({ error: '归档写入失败，原记录未改动，可重试' })
    }
  },
}))
