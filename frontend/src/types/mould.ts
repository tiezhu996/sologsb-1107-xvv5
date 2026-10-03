export const WIRE_MATERIALS = ['竹丝', '铜丝', '马尾丝'] as const
export type WireMaterial = (typeof WIRE_MATERIALS)[number]

export const MOULD_STATES = ['在用', '待修补', '退役'] as const
export type MouldStateValue = (typeof MOULD_STATES)[number]

/** 纸帘规格来源：初始登记或某张已应用的返修单 */
export type MouldSpecSource =
  | { kind: 'initial' }
  | { kind: 'repair'; repairOrderNo: string; appliedAt: string }

export interface Mould {
  id?: number
  mouldNo: string
  frameW: number
  frameH: number
  wireMaterial: WireMaterial
  wireDiameter: number
  stripeGap: number
  meshDensity: number
  weaver: string
  state: MouldStateValue
  /** 结构版本：v3 起引入规格版本化 */
  schemaRev?: number
  /** 当前规格版本号：初始为 1，每应用一张返修单 +1 */
  specRev: number
  /** 当前规格的来源说明 */
  specSource: MouldSpecSource
  /** 尚未应用的返修单编号（一次最多挂一张） */
  pendingRepairOrderNo?: string
}

export type MouldInput = Omit<Mould, 'id' | 'schemaRev'>
