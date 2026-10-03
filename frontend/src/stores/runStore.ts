import { create } from 'zustand'
import type { SheetRun, SheetRunInput } from '../types/sheet-run'
import { CURRENT_SCHEMA_REV, db, plain } from '../utils/db'
import { snapshotForRun } from '../utils/specVersion'
import { calculateDeviation } from '../utils/stripe'
import type { Mould } from '../types/mould'

interface RunStore {
  sheetRuns: SheetRun[]
  isLoading: boolean
  loaded: boolean
  error: string | null
  loadRuns: (force?: boolean) => Promise<void>
  addRun: (input: SheetRunInput, mould: Mould) => Promise<SheetRun | null>
  updateMeasuredGap: (id: number, measuredGap: number) => Promise<void>
}

export const useRunStore = create<RunStore>((set, get) => ({
  sheetRuns: [],
  isLoading: false,
  loaded: false,
  error: null,
  loadRuns: async (force = false) => {
    if (get().loaded && !force) return
    set({ isLoading: true, error: null })
    try {
      const sheetRuns = await db.sheetRuns.orderBy('runDate').reverse().toArray()
      set({ sheetRuns, isLoading: false, loaded: true })
    } catch {
      set({ isLoading: false, error: '抄纸工序读取失败，请检查浏览器存储权限' })
    }
  },
  addRun: async (input, mould) => {
    set({ error: null })
    try {
      // 登记时把纸帘当前规格锁进工序；新工序才用返修后的版本
      const spec = snapshotForRun(mould)
      const deviation = calculateDeviation(input.measuredGap, spec.specStripeGap)
      const payload: SheetRun = {
        ...plain(input),
        deviation,
        ...spec,
        schemaRev: CURRENT_SCHEMA_REV,
      }
      const id = Number(await db.sheetRuns.add(payload))
      const created: SheetRun = { ...payload, id }
      set((state) => ({ sheetRuns: [created, ...state.sheetRuns] }))
      return created
    } catch {
      set({ error: '工序登记失败，请检查工序编号是否重复' })
      return null
    }
  },
  updateMeasuredGap: async (id, measuredGap) => {
    // 偏差始终按该工序锁定版本的标准间距，不随纸帘返修而改判
    const existing = get().sheetRuns.find((run) => run.id === id)
    const standardGap = existing?.specStripeGap ?? measuredGap
    const deviation = calculateDeviation(measuredGap, standardGap)
    try {
      await db.sheetRuns.update(id, { measuredGap, deviation })
      set((state) => ({
        sheetRuns: state.sheetRuns.map((run) => (run.id === id ? { ...run, measuredGap, deviation } : run)),
        error: null,
      }))
    } catch {
      set({ error: '实测间距更新失败' })
    }
  },
}))
