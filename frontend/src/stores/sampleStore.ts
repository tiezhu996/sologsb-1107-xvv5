import { create } from 'zustand'
import type { PaperSample, PaperSampleInput } from '../types/paper-sample'
import { CURRENT_SCHEMA_REV, db, plain } from '../utils/db'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface SampleStore {
  paperSamples: PaperSample[]
  isLoading: boolean
  loaded: boolean
  error: string | null
  loadSamples: () => Promise<void>
  addSample: (input: PaperSampleInput) => Promise<PaperSample | null>
  recheckSample: (id: number) => Promise<boolean>
  archiveSample: (id: number) => Promise<boolean>
}

export const useSampleStore = create<SampleStore>((set, get) => ({
  paperSamples: [],
  isLoading: false,
  loaded: false,
  error: null,
  loadSamples: async () => {
    if (get().loaded) return
    set({ isLoading: true, error: null })
    try {
      const paperSamples = await db.paperSamples.orderBy('sampleNo').toArray()
      set({ paperSamples, isLoading: false, loaded: true })
    } catch {
      set({ isLoading: false, error: '样本档案读取失败，请检查浏览器存储权限' })
    }
  },
  addSample: async (input) => {
    set({ error: null })
    try {
      const payload = plain({ ...input, schemaRev: CURRENT_SCHEMA_REV })
      const id = Number(await db.paperSamples.add(payload))
      const created: PaperSample = { ...payload, id }
      set((state) => ({ paperSamples: [created, ...state.paperSamples] }))
      return created
    } catch {
      set({ error: '样本登记失败，请检查样本编号是否重复' })
      return null
    }
  },
  recheckSample: async (id) => {
    const sample = get().paperSamples.find((item) => item.id === id)
    if (!sample || (sample.recheckState ?? '未复检') === '已复检') return false
    const recheckedAt = todayIso()
    try {
      await db.paperSamples.update(id, { recheckState: '已复检', recheckedAt, schemaRev: CURRENT_SCHEMA_REV })
      set((state) => ({
        paperSamples: state.paperSamples.map((item) =>
          item.id === id ? { ...item, recheckState: '已复检', recheckedAt, schemaRev: CURRENT_SCHEMA_REV } : item,
        ),
        error: null,
      }))
      return true
    } catch {
      set({ error: '样本复检登记失败，请重试' })
      return false
    }
  },
  archiveSample: async (id) => {
    const sample = get().paperSamples.find((item) => item.id === id)
    if (!sample || (sample.archiveState ?? '待归档') === '已归档') return false
    if ((sample.recheckState ?? '未复检') !== '已复检') {
      set({ error: `样本 ${sample.sampleNo} 尚未复检，复检后才能归档` })
      return false
    }
    const archivedAt = todayIso()
    try {
      await db.paperSamples.update(id, { archiveState: '已归档', archivedAt, schemaRev: CURRENT_SCHEMA_REV })
      set((state) => ({
        paperSamples: state.paperSamples.map((item) =>
          item.id === id ? { ...item, archiveState: '已归档', archivedAt, schemaRev: CURRENT_SCHEMA_REV } : item,
        ),
        error: null,
      }))
      return true
    } catch {
      set({ error: '样本归档失败，请重试' })
      return false
    }
  },
}))
