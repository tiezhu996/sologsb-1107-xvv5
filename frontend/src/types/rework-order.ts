export const REWORK_ORDER_STATES = ['待应用', '已应用', '已作废'] as const
export type ReworkOrderState = (typeof REWORK_ORDER_STATES)[number]

export interface ReworkOrder {
  id?: number
  orderNo: string
  mouldId: number
  reason: string
  prevSpecRev: number
  prevWireDiameter: number
  prevStripeGap: number
  prevMeshDensity: number
  nextWireDiameter: number
  nextStripeGap: number
  nextMeshDensity: number
  state: ReworkOrderState
  createdAt: string
  appliedAt?: string
  flaggedSampleIds: number[]
  schemaRev?: number
}

export type ReworkOrderInput = Omit<ReworkOrder, 'id' | 'schemaRev' | 'state' | 'appliedAt' | 'flaggedSampleIds'>
