import { create } from 'zustand'
import type { ReworkOrder, ReworkOrderInput } from '../types/rework-order'
import { CURRENT_SCHEMA_REV, db, plain } from '../utils/db'
import { useMouldStore } from './mouldStore'
import { useSampleStore } from './sampleStore'

interface ReworkStore {
  reworkOrders: ReworkOrder[]
  isLoading: boolean
  loaded: boolean
  error: string | null
  loadReworkOrders: () => Promise<void>
  addReworkOrder: (input: ReworkOrderInput) => Promise<ReworkOrder | null>
  applyReworkOrder: (id: number) => Promise<ReworkOrder | null>
  cancelReworkOrder: (id: number) => Promise<void>
}

async function refreshMouldsAndSamples(): Promise<void> {
  useMouldStore.setState({ loaded: false })
  useSampleStore.setState({ loaded: false })
  await Promise.all([useMouldStore.getState().loadMoulds(), useSampleStore.getState().loadSamples()])
}

export const useReworkStore = create<ReworkStore>((set, get) => ({
  reworkOrders: [],
  isLoading: false,
  loaded: false,
  error: null,
  loadReworkOrders: async () => {
    if (get().loaded) return
    set({ isLoading: true, error: null })
    try {
      const reworkOrders = await db.reworkOrders.orderBy('orderNo').reverse().toArray()
      set({ reworkOrders, isLoading: false, loaded: true })
    } catch {
      set({ isLoading: false, error: '返修单读取失败，请检查浏览器存储权限' })
    }
  },
  addReworkOrder: async (input) => {
    set({ error: null })
    try {
      const payload: ReworkOrder = plain({
        ...input,
        state: '待应用',
        flaggedSampleIds: [],
        schemaRev: CURRENT_SCHEMA_REV,
      })
      const id = await db.transaction('rw', [db.reworkOrders, db.moulds], async () => {
        const mould = await db.moulds.get(payload.mouldId)
        if (!mould) throw new Error('返修单关联的纸帘不存在')
        const orderId = Number(await db.reworkOrders.add(payload))
        if (mould.state !== '退役') {
          await db.moulds.update(payload.mouldId, { state: '待修补', schemaRev: CURRENT_SCHEMA_REV })
        }
        return orderId
      })
      const created: ReworkOrder = { ...payload, id }
      set((state) => ({ reworkOrders: [created, ...state.reworkOrders] }))
      useMouldStore.setState({ loaded: false })
      await useMouldStore.getState().loadMoulds()
      return created
    } catch {
      set({ error: '返修单登记失败，原有数据未改动，请检查单号是否重复后重试' })
      return null
    }
  },
  applyReworkOrder: async (id) => {
    set({ error: null })
    try {
      let applied: ReworkOrder | null = null
      await db.transaction('rw', [db.reworkOrders, db.moulds, db.sheetRuns, db.paperSamples], async () => {
        const order = await db.reworkOrders.get(id)
        if (!order || order.state !== '待应用') throw new Error('返修单不存在或已处理')
        const mould = await db.moulds.get(order.mouldId)
        if (!mould || mould.id === undefined) throw new Error('返修单关联的纸帘不存在')
        // 应用前标出该纸帘尚未复检的成纸样本，复检后才能归档
        const runs = await db.sheetRuns.where('mouldId').equals(order.mouldId).toArray()
        const runIds = new Set(runs.map((run) => run.id))
        const samples = await db.paperSamples.toArray()
        const flagged = samples.filter(
          (sample) =>
            sample.id !== undefined &&
            runIds.has(sample.runId) &&
            (sample.recheckState ?? '未复检') !== '已复检' &&
            (sample.archiveState ?? '待归档') !== '已归档',
        )
        for (const sample of flagged) {
          await db.paperSamples.update(sample.id as number, { recheckState: '待复检', schemaRev: CURRENT_SCHEMA_REV })
        }
        // 纸帘台帐换用返修后的现行规格，既有工序与样本仍锁定各自版本
        const nextSpecRev = (mould.specRev ?? 1) + 1
        await db.moulds.update(mould.id, {
          wireDiameter: order.nextWireDiameter,
          stripeGap: order.nextStripeGap,
          meshDensity: order.nextMeshDensity,
          specRev: nextSpecRev,
          state: '在用',
          schemaRev: CURRENT_SCHEMA_REV,
        })
        const appliedAt = new Date().toISOString()
        const flaggedSampleIds = flagged.map((sample) => sample.id as number)
        await db.reworkOrders.update(id, {
          state: '已应用',
          appliedAt,
          flaggedSampleIds,
          schemaRev: CURRENT_SCHEMA_REV,
        })
        applied = { ...order, state: '已应用', appliedAt, flaggedSampleIds, schemaRev: CURRENT_SCHEMA_REV }
      })
      if (applied) {
        const appliedOrder: ReworkOrder = applied
        set((state) => ({
          reworkOrders: state.reworkOrders.map((order) => (order.id === id ? appliedOrder : order)),
          error: null,
        }))
      }
      await refreshMouldsAndSamples()
      return applied
    } catch {
      // 事务整体回滚，原数据保留，返修单维持“待应用”可重试
      set({ error: '返修单应用失败，原有数据未改动，可检查后重试' })
      return null
    }
  },
  cancelReworkOrder: async (id) => {
    set({ error: null })
    try {
      await db.transaction('rw', [db.reworkOrders, db.moulds], async () => {
        const order = await db.reworkOrders.get(id)
        if (!order || order.state !== '待应用') throw new Error('返修单不存在或已处理')
        await db.reworkOrders.update(id, { state: '已作废', schemaRev: CURRENT_SCHEMA_REV })
        const mould = await db.moulds.get(order.mouldId)
        if (mould && mould.state === '待修补') {
          await db.moulds.update(order.mouldId, { state: '在用', schemaRev: CURRENT_SCHEMA_REV })
        }
      })
      set((state) => ({
        reworkOrders: state.reworkOrders.map((order) =>
          order.id === id ? { ...order, state: '已作废', schemaRev: CURRENT_SCHEMA_REV } : order,
        ),
        error: null,
      }))
      useMouldStore.setState({ loaded: false })
      await useMouldStore.getState().loadMoulds()
    } catch {
      set({ error: '返修单作废失败，原有数据未改动，可重试' })
    }
  },
}))
