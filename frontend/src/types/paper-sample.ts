export const EVENNESS_LEVELS = ['均匀', '略花', '花'] as const
export type EvennessLevel = (typeof EVENNESS_LEVELS)[number]

export interface PaperSample {
  id?: number
  sampleNo: string
  runId: number
  sizeMm: number
  stripeCount: number
  evenness: EvennessLevel
  /** 待复检时放“待复检区”，复检通过并归档后才写具体柜位 */
  archiveBin: string
  schemaRev?: number
  /** 复检通过前为 false，返修单应用前后都必须复检才能归档 */
  rechecked: boolean
  /** 是否已归档（复检通过后方可） */
  archived: boolean
  /** 复检记录（复检人、日期、说明） */
  recheckNote?: string
  /** 由哪张返修单触发的复检（登记返修单时标出） */
  flaggedByRepairOrderNo?: string
  /** 锁定的纸帘规格版本，随对应工序 */
  specRev: number
}

export type PaperSampleInput = Omit<
  PaperSample,
  'id' | 'schemaRev' | 'rechecked' | 'archived' | 'recheckNote' | 'flaggedByRepairOrderNo' | 'specRev'
>
