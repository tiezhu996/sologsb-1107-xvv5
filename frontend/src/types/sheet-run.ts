export const STRIPE_DIRECTIONS = ['竖帘纹', '横帘纹'] as const
export type StripeDirection = (typeof STRIPE_DIRECTIONS)[number]

export const DRY_METHODS = ['火墙', '日晒'] as const
export type DryMethod = (typeof DRY_METHODS)[number]

export interface SheetRun {
  id?: number
  runNo: string
  mouldId: number
  batchId: number
  runDate: string
  operator: string
  stripeDirection: StripeDirection
  dipCount: number
  stackHeight: number
  dryMethod: DryMethod
  grammage: number
  measuredGap: number
  deviation: number
  schemaRev?: number
  /** 登记时锁定的纸帘规格版本 */
  specRev: number
  /** 锁定版本的丝径 mm */
  specWireDiameter: number
  /** 锁定版本的帘纹间距标准值 mm，偏差判定始终以此为准 */
  specStripeGap: number
  /** 锁定版本的网目密度 根/cm */
  specMeshDensity: number
}

/** 规格快照由系统依据纸帘当前版本填入，登记表单不提供 */
export type SheetRunInput = Omit<
  SheetRun,
  'id' | 'schemaRev' | 'specRev' | 'specWireDiameter' | 'specStripeGap' | 'specMeshDensity'
>
