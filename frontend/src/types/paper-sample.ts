export const EVENNESS_LEVELS = ['均匀', '略花', '花'] as const
export type EvennessLevel = (typeof EVENNESS_LEVELS)[number]

export const RECHECK_STATES = ['未复检', '待复检', '已复检'] as const
export type RecheckState = (typeof RECHECK_STATES)[number]

export const ARCHIVE_STATES = ['待归档', '已归档'] as const
export type ArchiveState = (typeof ARCHIVE_STATES)[number]

export interface PaperSample {
  id?: number
  sampleNo: string
  runId: number
  sizeMm: number
  stripeCount: number
  evenness: EvennessLevel
  archiveBin: string
  /** 登记样本时锁定的纸帘规格版本（取自对应工序） */
  specRev: number
  /** 返修单应用时会把未复检样本标为“待复检”，复检后才能归档 */
  recheckState: RecheckState
  archiveState: ArchiveState
  recheckedAt?: string
  archivedAt?: string
  schemaRev?: number
}

export type PaperSampleInput = Omit<PaperSample, 'id' | 'schemaRev' | 'recheckedAt' | 'archivedAt'>
