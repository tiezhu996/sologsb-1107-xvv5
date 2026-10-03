import Dexie, { type Table } from 'dexie'
import type { FiberBatch } from '../types/fiber-batch'
import type { Mould } from '../types/mould'
import type { PaperSample } from '../types/paper-sample'
import type { ReworkOrder } from '../types/rework-order'
import type { SheetRun } from '../types/sheet-run'
import { calculateDeviation, calculateMeshDensity } from './stripe'

export const CURRENT_SCHEMA_REV = 3

export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function currentWeekDate(dayOffset: number): string {
  const date = new Date()
  const day = date.getDay()
  const mondayDistance = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + mondayDistance + dayOffset)
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const seedMoulds: Mould[] = [
  { id: 1, mouldNo: 'DL-01', frameW: 60, frameH: 90, wireMaterial: '竹丝', wireDiameter: 0.3, stripeGap: 1.1, meshDensity: calculateMeshDensity(0.3, 1.1), weaver: '周守良', state: '在用', specRev: 1, schemaRev: CURRENT_SCHEMA_REV },
  { id: 2, mouldNo: 'DL-02', frameW: 55, frameH: 82, wireMaterial: '铜丝', wireDiameter: 0.18, stripeGap: 0.8, meshDensity: calculateMeshDensity(0.18, 0.8), weaver: '沈云舟', state: '在用', specRev: 2, schemaRev: CURRENT_SCHEMA_REV },
  { id: 3, mouldNo: 'DL-03', frameW: 72, frameH: 105, wireMaterial: '竹丝', wireDiameter: 0.28, stripeGap: 1.0, meshDensity: calculateMeshDensity(0.28, 1), weaver: '周守良', state: '在用', specRev: 1, schemaRev: CURRENT_SCHEMA_REV },
  { id: 4, mouldNo: 'DL-04', frameW: 50, frameH: 76, wireMaterial: '马尾丝', wireDiameter: 0.32, stripeGap: 1.25, meshDensity: calculateMeshDensity(0.32, 1.25), weaver: '林砚秋', state: '待修补', specRev: 1, schemaRev: CURRENT_SCHEMA_REV },
  { id: 5, mouldNo: 'DL-05', frameW: 65, frameH: 96, wireMaterial: '铜丝', wireDiameter: 0.18, stripeGap: 0.72, meshDensity: calculateMeshDensity(0.18, 0.72), weaver: '沈云舟', state: '退役', specRev: 1, schemaRev: CURRENT_SCHEMA_REV },
]

const seedBatches: FiberBatch[] = [
  { id: 1, batchNo: 'XW-2601', material: '构皮', origin: '陕西洋县华阳镇', cookAgent: '石灰', cookHours: 9, bleachMethod: '日晒', beatingDegree: 32, operator: '罗青禾', schemaRev: CURRENT_SCHEMA_REV },
  { id: 2, batchNo: 'XW-2602', material: '桑皮', origin: '安徽泾县小岭村', cookAgent: '纯碱', cookHours: 7, bleachMethod: '日晒', beatingDegree: 38, operator: '汪知远', schemaRev: CURRENT_SCHEMA_REV },
  { id: 3, batchNo: 'XW-2603', material: '竹麻', origin: '四川夹江马村镇', cookAgent: '石灰', cookHours: 11, bleachMethod: '漂白粉', beatingDegree: 27, operator: '郭文山', schemaRev: CURRENT_SCHEMA_REV },
  { id: 4, batchNo: 'XW-2604', material: '稻草', origin: '浙江富阳大源镇', cookAgent: '纯碱', cookHours: 6, bleachMethod: '日晒', beatingDegree: 24, operator: '蒋允中', schemaRev: CURRENT_SCHEMA_REV },
  { id: 5, batchNo: 'XW-2605', material: '构皮', origin: '贵州丹寨石桥村', cookAgent: '石灰', cookHours: 8, bleachMethod: '漂白粉', beatingDegree: 35, operator: '罗青禾', schemaRev: CURRENT_SCHEMA_REV },
]

const gap1 = 1.1
const gap2Prev = 0.85
const gap2Next = 0.8
const gap3 = 1.0
const gap4 = 0.72
const seedRuns: SheetRun[] = [
  { id: 1, runNo: 'CB-260701', mouldId: 1, batchId: 1, runDate: currentWeekDate(0), operator: '罗青禾', stripeDirection: '竖帘纹', dipCount: 2, stackHeight: 42, dryMethod: '火墙', grammage: 32, measuredGap: 1.08, deviation: calculateDeviation(1.08, gap1), specRev: 1, specWireDiameter: 0.3, specStripeGap: gap1, schemaRev: CURRENT_SCHEMA_REV },
  { id: 2, runNo: 'CB-260702', mouldId: 2, batchId: 2, runDate: currentWeekDate(1), operator: '汪知远', stripeDirection: '竖帘纹', dipCount: 1, stackHeight: 36, dryMethod: '火墙', grammage: 29, measuredGap: 0.84, deviation: calculateDeviation(0.84, gap2Next), specRev: 2, specWireDiameter: 0.18, specStripeGap: gap2Next, schemaRev: CURRENT_SCHEMA_REV },
  { id: 3, runNo: 'CB-260703', mouldId: 3, batchId: 3, runDate: currentWeekDate(2), operator: '郭文山', stripeDirection: '横帘纹', dipCount: 2, stackHeight: 48, dryMethod: '日晒', grammage: 41, measuredGap: 1.03, deviation: calculateDeviation(1.03, gap3), specRev: 1, specWireDiameter: 0.28, specStripeGap: gap3, schemaRev: CURRENT_SCHEMA_REV },
  { id: 4, runNo: 'CB-260704', mouldId: 1, batchId: 5, runDate: daysAgo(3), operator: '罗青禾', stripeDirection: '竖帘纹', dipCount: 3, stackHeight: 55, dryMethod: '火墙', grammage: 36, measuredGap: 1.36, deviation: calculateDeviation(1.36, gap1), specRev: 1, specWireDiameter: 0.3, specStripeGap: gap1, schemaRev: CURRENT_SCHEMA_REV },
  { id: 5, runNo: 'CB-260705', mouldId: 2, batchId: 4, runDate: daysAgo(6), operator: '蒋允中', stripeDirection: '竖帘纹', dipCount: 2, stackHeight: 44, dryMethod: '日晒', grammage: 46, measuredGap: 0.82, deviation: calculateDeviation(0.82, gap2Prev), specRev: 1, specWireDiameter: 0.2, specStripeGap: gap2Prev, schemaRev: CURRENT_SCHEMA_REV },
  { id: 6, runNo: 'CB-260706', mouldId: 3, batchId: 2, runDate: daysAgo(10), operator: '汪知远', stripeDirection: '竖帘纹', dipCount: 1, stackHeight: 31, dryMethod: '火墙', grammage: 27, measuredGap: 0.94, deviation: calculateDeviation(0.94, gap3), specRev: 1, specWireDiameter: 0.28, specStripeGap: gap3, schemaRev: CURRENT_SCHEMA_REV },
  { id: 7, runNo: 'CB-260707', mouldId: 4, batchId: 1, runDate: daysAgo(17), operator: '林砚秋', stripeDirection: '横帘纹', dipCount: 2, stackHeight: 39, dryMethod: '日晒', grammage: 34, measuredGap: 1.5, deviation: calculateDeviation(1.5, 1.25), specRev: 1, specWireDiameter: 0.32, specStripeGap: 1.25, schemaRev: CURRENT_SCHEMA_REV },
  { id: 8, runNo: 'CB-260708', mouldId: 5, batchId: 3, runDate: daysAgo(24), operator: '郭文山', stripeDirection: '竖帘纹', dipCount: 2, stackHeight: 46, dryMethod: '火墙', grammage: 44, measuredGap: 0.71, deviation: calculateDeviation(0.71, gap4), specRev: 1, specWireDiameter: 0.18, specStripeGap: gap4, schemaRev: CURRENT_SCHEMA_REV },
]

const seedSamples: PaperSample[] = [
  { id: 1, sampleNo: 'YZ-01', runId: 1, sizeMm: 210, stripeCount: 46, evenness: '均匀', archiveBin: '甲柜-03', specRev: 1, recheckState: '已复检', archiveState: '已归档', recheckedAt: daysAgo(3), archivedAt: daysAgo(2), schemaRev: CURRENT_SCHEMA_REV },
  { id: 2, sampleNo: 'YZ-02', runId: 2, sizeMm: 180, stripeCount: 52, evenness: '略花', archiveBin: '甲柜-07', specRev: 2, recheckState: '未复检', archiveState: '待归档', schemaRev: CURRENT_SCHEMA_REV },
  { id: 3, sampleNo: 'YZ-03', runId: 3, sizeMm: 240, stripeCount: 39, evenness: '花', archiveBin: '乙柜-02', specRev: 1, recheckState: '未复检', archiveState: '待归档', schemaRev: CURRENT_SCHEMA_REV },
  { id: 4, sampleNo: 'YZ-04', runId: 4, sizeMm: 210, stripeCount: 31, evenness: '略花', archiveBin: '乙柜-05', specRev: 1, recheckState: '未复检', archiveState: '待归档', schemaRev: CURRENT_SCHEMA_REV },
  { id: 5, sampleNo: 'YZ-05', runId: 5, sizeMm: 200, stripeCount: 48, evenness: '均匀', archiveBin: '甲柜-11', specRev: 1, recheckState: '待复检', archiveState: '待归档', schemaRev: CURRENT_SCHEMA_REV },
  { id: 6, sampleNo: 'YZ-06', runId: 6, sizeMm: 260, stripeCount: 57, evenness: '均匀', archiveBin: '丙柜-01', specRev: 1, recheckState: '已复检', archiveState: '待归档', recheckedAt: daysAgo(4), schemaRev: CURRENT_SCHEMA_REV },
  { id: 7, sampleNo: 'YZ-07', runId: 7, sizeMm: 220, stripeCount: 44, evenness: '略花', archiveBin: '乙柜-08', specRev: 1, recheckState: '未复检', archiveState: '待归档', schemaRev: CURRENT_SCHEMA_REV },
]

const seedReworkOrders: ReworkOrder[] = [
  {
    id: 1,
    orderNo: 'FX-2601',
    mouldId: 2,
    reason: '铜丝磨损起毛，透光见毛刺，换丝重织并收紧帘纹。',
    prevSpecRev: 1,
    prevWireDiameter: 0.2,
    prevStripeGap: 0.85,
    prevMeshDensity: calculateMeshDensity(0.2, 0.85),
    nextWireDiameter: 0.18,
    nextStripeGap: 0.8,
    nextMeshDensity: calculateMeshDensity(0.18, 0.8),
    state: '已应用',
    createdAt: daysAgo(8),
    appliedAt: daysAgo(5),
    flaggedSampleIds: [5],
    schemaRev: CURRENT_SCHEMA_REV,
  },
  {
    id: 2,
    orderNo: 'FX-2602',
    mouldId: 4,
    reason: '帘边断丝三处，抄纸时挂浆，拟换马尾丝重织并收窄间距。',
    prevSpecRev: 1,
    prevWireDiameter: 0.32,
    prevStripeGap: 1.25,
    prevMeshDensity: calculateMeshDensity(0.32, 1.25),
    nextWireDiameter: 0.3,
    nextStripeGap: 1.15,
    nextMeshDensity: calculateMeshDensity(0.3, 1.15),
    state: '待应用',
    createdAt: daysAgo(1),
    flaggedSampleIds: [],
    schemaRev: CURRENT_SCHEMA_REV,
  },
]

class GbPaperMillDatabase extends Dexie {
  moulds!: Table<Mould, number>
  fiberBatches!: Table<FiberBatch, number>
  sheetRuns!: Table<SheetRun, number>
  paperSamples!: Table<PaperSample, number>
  reworkOrders!: Table<ReworkOrder, number>

  constructor() {
    super('gbpapermill-db')
    this.version(1).stores({
      moulds: '++id,&mouldNo,state,wireMaterial',
      fiberBatches: '++id,&batchNo,material,beatingDegree',
      sheetRuns: '++id,&runNo,mouldId,batchId,runDate,operator',
      paperSamples: '++id,&sampleNo,runId,evenness,stripeCount',
    })
    this.version(2).stores({
      moulds: '++id,&mouldNo,state,wireMaterial,schemaRev',
      fiberBatches: '++id,&batchNo,material,beatingDegree,schemaRev',
      sheetRuns: '++id,&runNo,mouldId,batchId,runDate,operator,schemaRev',
      paperSamples: '++id,&sampleNo,runId,evenness,stripeCount,schemaRev',
    }).upgrade(async (transaction) => {
      await transaction.table('moulds').toCollection().modify((value: Record<string, unknown>) => {
        value.schemaRev = 2
      })
      await transaction.table('fiberBatches').toCollection().modify((value: Record<string, unknown>) => {
        value.schemaRev = 2
      })
      await transaction.table('sheetRuns').toCollection().modify((value: Record<string, unknown>) => {
        value.schemaRev = 2
      })
      await transaction.table('paperSamples').toCollection().modify((value: Record<string, unknown>) => {
        value.schemaRev = 2
      })
    })
    this.version(3).stores({
      moulds: '++id,&mouldNo,state,wireMaterial,schemaRev',
      fiberBatches: '++id,&batchNo,material,beatingDegree,schemaRev',
      sheetRuns: '++id,&runNo,mouldId,batchId,runDate,operator,schemaRev',
      paperSamples: '++id,&sampleNo,runId,evenness,stripeCount,schemaRev,recheckState,archiveState',
      reworkOrders: '++id,&orderNo,mouldId,state',
    }).upgrade(async (transaction) => {
      // 纸帘台帐保留当前规格，从版本 1 起计
      await transaction.table('moulds').toCollection().modify((value: Record<string, unknown>) => {
        value.specRev = typeof value.specRev === 'number' ? value.specRev : 1
        value.schemaRev = CURRENT_SCHEMA_REV
      })
      const moulds = (await transaction.table('moulds').toArray()) as Mould[]
      const mouldById = new Map(moulds.map((mould) => [mould.id, mould]))
      // 既有工序锁定登记时的规格快照，偏差仍按当时规格判定
      await transaction.table('sheetRuns').toCollection().modify((value: Record<string, unknown>) => {
        const mould = mouldById.get(value.mouldId as number)
        const specStripeGap = typeof mould?.stripeGap === 'number' ? mould.stripeGap : (value.measuredGap as number) ?? 0
        value.specRev = mould?.specRev ?? 1
        value.specWireDiameter = mould?.wireDiameter ?? 0
        value.specStripeGap = specStripeGap
        if (typeof value.measuredGap === 'number') {
          value.deviation = calculateDeviation(value.measuredGap, specStripeGap)
        }
        value.schemaRev = CURRENT_SCHEMA_REV
      })
      const runs = (await transaction.table('sheetRuns').toArray()) as SheetRun[]
      const runById = new Map(runs.map((run) => [run.id, run]))
      // 既有样本锁定对应工序的规格版本，并进入显式复检/归档流程
      await transaction.table('paperSamples').toCollection().modify((value: Record<string, unknown>) => {
        const run = runById.get(value.runId as number)
        value.specRev = run?.specRev ?? 1
        value.recheckState = typeof value.recheckState === 'string' ? value.recheckState : '未复检'
        value.archiveState = typeof value.archiveState === 'string' ? value.archiveState : '待归档'
        value.schemaRev = CURRENT_SCHEMA_REV
      })
      await transaction.table('fiberBatches').toCollection().modify((value: Record<string, unknown>) => {
        value.schemaRev = CURRENT_SCHEMA_REV
      })
    })
    this.on('populate', () => this.seed())
  }

  private async seed(): Promise<void> {
    await this.moulds.bulkAdd(plain(seedMoulds))
    await this.fiberBatches.bulkAdd(plain(seedBatches))
    await this.sheetRuns.bulkAdd(plain(seedRuns))
    await this.paperSamples.bulkAdd(plain(seedSamples))
    await this.reworkOrders.bulkAdd(plain(seedReworkOrders))
  }
}

export const db = new GbPaperMillDatabase()
