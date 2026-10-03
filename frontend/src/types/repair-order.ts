import type { WireMaterial } from './mould'

/** 返修单生命周期状态 */
export const REPAIR_ORDER_STATES = ['待应用', '已应用', '失败'] as const
export type RepairOrderState = (typeof REPAIR_ORDER_STATES)[number]

/**
 * 返修单：纸帘返修后可能更换丝径或帘纹间距。
 * 单内同时保存“原规格（拟改前快照）”与“拟改规格 + 原因”，可核对。
 * 旧抄纸工序与样本继续按登记时锁定的规格版本判定；只有应用后的新工序才用拟改规格。
 */
export interface MouldRepairOrder {
  id?: number
  /** 返修单号，如 FX-260903 */
  orderNo: string
  mouldId: number
  /** 送修/登记日期 */
  registeredAt: string
  /** 应用日期（写入纸帘当前规格时回填） */
  appliedAt?: string
  state: RepairOrderState
  reason: string
  /** 拟改前：原规格快照 */
  fromWireDiameter: number
  fromStripeGap: number
  fromMeshDensity: number
  /** 拟改后：新规格（应用后即纸帘当前规格） */
  toWireDiameter: number
  toStripeGap: number
  toMeshDensity: number
  wireMaterial: WireMaterial
  /** 从第几版升到第几版，如 1 -> 2 */
  fromSpecRev: number
  toSpecRev: number
  /** 登记时标出的、应用前必须复检的成纸样本 id */
  flaggedSampleIds: number[]
  /** 最近一次写入失败的原因，保留原数据并允许重试 */
  lastError?: string
  schemaRev?: number
}

export interface RepairOrderDraft {
  orderNo: string
  mouldId: number
  registeredAt: string
  reason: string
  toWireDiameter: number
  toStripeGap: number
}
