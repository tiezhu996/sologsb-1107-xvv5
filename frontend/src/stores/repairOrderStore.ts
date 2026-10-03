import { create } from 'zustand'
import type { MouldRepairOrder, RepairOrderDraft } from '../types/repair-order'
import { CURRENT_SCHEMA_REV, db, plain } from '../utils/db'
import { proposedDensity } from '../utils/specVersion'
import type { Mould } from '../types/mould'
import type { PaperSample } from '../types/paper-sample'

interface RepairOrderStore {
  repairOrders: MouldRepairOrder[]
  isLoading: boolean
  loaded: boolean
  error: string | null
  loadRepairOrders: (force?: boolean) => Promise<void>
  /**
   * 登记返修单（可核对：含原规格快照、拟改规格与原因）。
   * 同时把该纸帘关联的成纸样本标为“待复检”。整体在一个事务内，任一写入失败全部回滚。
   */
  registerRepairOrder: (draft: RepairOrderDraft, mould: Mould) => Promise<{ order: MouldRepairOrder; affectedSamples: PaperSample[] } | null>
  /** 应用（或重试）返修单：把拟改规格写为纸帘当前规格，版本号 +1。失败则保留原数据。 */
  applyRepairOrder: (id: number) => Promise<boolean>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useRepairOrderStore = create<RepairOrderStore>((set, get) => ({
  repairOrders: [],
  isLoading: false,
  loaded: false,
  error: null,
  loadRepairOrders: async (force = false) => {
    if (get().loaded && !force) return
    set({ isLoading: true, error: null })
    try {
      const repairOrders = await db.repairOrders.orderBy('registeredAt').reverse().toArray()
      set({ repairOrders, isLoading: false, loaded: true })
    } catch {
      set({ isLoading: false, error: '返修单读取失败，请检查浏览器存储权限' })
    }
  },

  registerRepairOrder: async (draft, mould) => {
    if (mould.id === undefined) return null
    set({ error: null })
    const mouldId = mould.id
    const toMeshDensity = proposedDensity(draft.toWireDiameter, draft.toStripeGap)
    const fromSpecRev = mould.specRev ?? 1

    try {
      const result = await db.transaction('rw', db.repairOrders, db.moulds, db.sheetRuns, db.paperSamples, async () => {
        // 校验仍挂起的返修单，避免重复登记
        const existing = await db.repairOrders.where('orderNo').equals(draft.orderNo).first()
        if (existing) throw new Error('repair-order-no-duplicate')
        const hasPending = await db.repairOrders.where({ mouldId, state: '待应用' }).first()
        if (hasPending) throw new Error('repair-order-pending')

        // 找出该纸帘关联工序下尚未复检/已归档之外需要标出的成纸样本
        const runs = await db.sheetRuns.where('mouldId').equals(mouldId).primaryKeys()
        const affectedIds: number[] = []
        if (runs.length > 0) {
          const linked = await db.paperSamples.where('runId').anyOf(runs as number[]).toArray()
          for (const sample of linked) {
            if (sample.id !== undefined && !sample.rechecked) affectedIds.push(sample.id)
          }
          if (affectedIds.length > 0) {
            await db.paperSamples
              .where('id')
              .anyOf(affectedIds)
              .modify({ rechecked: false, archived: false, flaggedByRepairOrderNo: draft.orderNo, archiveBin: '待复检区' })
          }
        }

        const orderPayload: MouldRepairOrder = {
          ...plain(draft),
          state: '待应用',
          wireMaterial: mould.wireMaterial,
          fromWireDiameter: mould.wireDiameter,
          fromStripeGap: mould.stripeGap,
          fromMeshDensity: mould.meshDensity,
          toMeshDensity,
          fromSpecRev,
          toSpecRev: fromSpecRev + 1,
          flaggedSampleIds: affectedIds,
          schemaRev: CURRENT_SCHEMA_REV,
        }
        const orderId = Number(await db.repairOrders.add(orderPayload))

        // 纸帘台帐保留当前规格，仅置为待修补并挂起返修单编号
        await db.moulds.update(mouldId, { state: '待修补', pendingRepairOrderNo: draft.orderNo })

        const created: MouldRepairOrder = { ...orderPayload, id: orderId }
        const affectedSamples = affectedIds.length
          ? await db.paperSamples.where('id').anyOf(affectedIds).toArray()
          : []
        return { order: created, affectedSamples }
      })

      set((state) => ({ repairOrders: [result.order, ...state.repairOrders] }))
      return result
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message === 'repair-order-no-duplicate'
          ? '返修单号已存在'
          : caught instanceof Error && caught.message === 'repair-order-pending'
            ? '该纸帘已有待应用的返修单'
            : '返修单写入失败，原数据保留，可重试'
      set({ error: `${message}；登记未生效` })
      return null
    }
  },

  applyRepairOrder: async (id) => {
    set({ error: null })
    try {
      await db.transaction('rw', db.repairOrders, db.moulds, async () => {
        const order = await db.repairOrders.get(id)
        if (!order) throw new Error('repair-order-missing')
        if (order.state === '已应用') return

        const mould = await db.moulds.get(order.mouldId)
        if (!mould) throw new Error('mould-missing')
        const appliedAt = todayIso()

        // 应用：拟改规格成为纸帘当前规格，版本号升到 toSpecRev；旧工序/样本保持锁定版本不变
        await db.moulds.update(mould.id as number, {
          wireDiameter: order.toWireDiameter,
          stripeGap: order.toStripeGap,
          meshDensity: order.toMeshDensity,
          specRev: order.toSpecRev,
          specSource: { kind: 'repair', repairOrderNo: order.orderNo, appliedAt },
          pendingRepairOrderNo: undefined,
          state: '在用',
        })
        await db.repairOrders.update(id, { state: '已应用', appliedAt, lastError: undefined })
      })
      return true
    } catch {
      // 事务整体回滚：纸帘与返修单原数据都保留，返修单仍是待应用/失败，可再次重试
      const order = get().repairOrders.find((item) => item.id === id)
      const lastError = '写入失败：规格未写入纸帘台帐，原数据保留，可重试'
      if (order) {
        try {
          await db.repairOrders.update(id, { state: '失败', lastError })
        } catch {
          /* 状态标记失败也不影响原数据，仍可重试 */
        }
        set((state) => ({
          repairOrders: state.repairOrders.map((item) =>
            item.id === id ? { ...item, state: '失败', lastError } : item),
        }))
      }
      set({ error: `返修单${order ? ` ${order.orderNo} ` : ''}应用失败，原数据保留，可重试` })
      return false
    }
  },
}))
