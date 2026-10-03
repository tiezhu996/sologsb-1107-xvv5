import Dexie, { type Table } from 'dexie'
import type { FiberBatch } from '../types/fiber-batch'
import type { Mould } from '../types/mould'
import type { MouldRepairOrder } from '../types/repair-order'
import type { PaperSample } from '../types/paper-sample'
import type { SheetRun } from '../types/sheet-run'
import { calculateDeviation, calculateMeshDensity } from './stripe'

/** 当前结构版本：v3 引入纸帘规格版本化与返修单 */
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

const density = (wireDiameter: number, gap: number) => calculateMeshDensity(wireDiameter, gap)

const seedMoulds: Mould[] = [
  { id: 1, mouldNo: 'DL-01', frameW: 60, frameH: 90, wireMaterial: '竹丝', wireDiameter: 0.3, stripeGap: 1.1, meshDensity: density(0.3, 1.1), weaver: '周守良', state: '在用', schemaRev: 3, specRev: 2, specSource: { kind: 'repair', repairOrderNo: 'FX-260715', appliedAt: daysAgo(42) } },
  { id: 2, mouldNo: 'DL-02', frameW: 55, frameH: 82, wireMaterial: '铜丝', wireDiameter: 0.2, stripeGap: 0.85, meshDensity: density(0.2, 0.85), weaver: '沈云舟', state: '在用', schemaRev: 3, specRev: 1, specSource: { kind: 'initial' } },
  { id: 3, mouldNo: 'DL-03', frameW: 72, frameH: 105, wireMaterial: '竹丝', wireDiameter: 0.28, stripeGap: 1.0, meshDensity: density(0.28, 1), weaver: '周守良', state: '待修补', schemaRev: 3, specRev: 1, specSource: { kind: 'initial' }, pendingRepairOrderNo: 'FX-260903' },
  { id: 4, mouldNo: 'DL-04', frameW: 50, frameH: 76, wireMaterial: '马尾丝', wireDiameter: 0.32, stripeGap: 1.25, meshDensity: density(0.32, 1.25), weaver: '林砚秋', state: '待修补', schemaRev: 3, specRev: 1, specSource: { kind: 'initial' } },
  { id: 5, mouldNo: 'DL-05', frameW: 65, frameH: 96, wireMaterial: '铜丝', wireDiameter: 0.18, stripeGap: 0.72, meshDensity: density(0.18, 0.72), weaver: '沈云舟', state: '退役', schemaRev: 3, specRev: 1, specSource: { kind: 'initial' } },
]

const seedBatches: FiberBatch[] = [
  { id: 1, batchNo: 'XW-2601', material: '构皮', origin: '陕西洋县华阳镇', cookAgent: '石灰', cookHours: 9, bleachMethod: '日晒', beatingDegree: 32, operator: '罗青禾', schemaRev: 3 },
  { id: 2, batchNo: 'XW-2602', material: '桑皮', origin: '安徽泾县小岭村', cookAgent: '纯碱', cookHours: 7, bleachMethod: '日晒', beatingDegree: 38, operator: '汪知远', schemaRev: 3 },
  { id: 3, batchNo: 'XW-2603', material: '竹麻', origin: '四川夹江马村镇', cookAgent: '石灰', cookHours: 11, bleachMethod: '漂白粉', beatingDegree: 27, operator: '郭文山', schemaRev: 3 },
  { id: 4, batchNo: 'XW-2604', material: '稻草', origin: '浙江富阳大源镇', cookAgent: '纯碱', cookHours: 6, bleachMethod: '日晒', beatingDegree: 24, operator: '蒋允中', schemaRev: 3 },
  { id: 5, batchNo: 'XW-2605', material: '构皮', origin: '贵州丹寨石桥村', cookAgent: '石灰', cookHours: 8, bleachMethod: '漂白粉', beatingDegree: 35, operator: '罗青禾', schemaRev: 3 },
]

// 各纸帘“登记当时”的规格快照，工序偏差始终按锁定版本判定
const gap1 = 1.1
const gap2 = 0.85
const gap3 = 1.0
const gap4 = 0.72
const seedRuns: SheetRun[] = [
  { id: 1, runNo: 'CB-260701', mouldId: 1, batchId: 1, runDate: currentWeekDate(0), operator: '罗青禾', stripeDirection: '竖帘纹', dipCount: 2, stackHeight: 42, dryMethod: '火墙', grammage: 32, measuredGap: 1.08, deviation: calculateDeviation(1.08, gap1), schemaRev: 3, specRev: 2, specWireDiameter: 0.3, specStripeGap: 1.1, specMeshDensity: density(0.3, 1.1) },
  { id: 2, runNo: 'CB-260702', mouldId: 2, batchId: 2, runDate: currentWeekDate(1), operator: '汪知远', stripeDirection: '竖帘纹', dipCount: 1, stackHeight: 36, dryMethod: '火墙', grammage: 29, measuredGap: 0.84, deviation: calculateDeviation(0.84, gap2), schemaRev: 3, specRev: 1, specWireDiameter: 0.2, specStripeGap: 0.85, specMeshDensity: density(0.2, 0.85) },
  { id: 3, runNo: 'CB-260703', mouldId: 3, batchId: 3, runDate: currentWeekDate(2), operator: '郭文山', stripeDirection: '横帘纹', dipCount: 2, stackHeight: 48, dryMethod: '日晒', grammage: 41, measuredGap: 1.03, deviation: calculateDeviation(1.03, gap3), schemaRev: 3, specRev: 1, specWireDiameter: 0.28, specStripeGap: 1.0, specMeshDensity: density(0.28, 1) },
  { id: 4, runNo: 'CB-260704', mouldId: 1, batchId: 5, runDate: daysAgo(3), operator: '罗青禾', stripeDirection: '竖帘纹', dipCount: 3, stackHeight: 55, dryMethod: '火墙', grammage: 36, measuredGap: 1.36, deviation: calculateDeviation(1.36, gap1), schemaRev: 3, specRev: 2, specWireDiameter: 0.3, specStripeGap: 1.1, specMeshDensity: density(0.3, 1.1) },
  { id: 5, runNo: 'CB-260705', mouldId: 2, batchId: 4, runDate: daysAgo(6), operator: '蒋允中', stripeDirection: '竖帘纹', dipCount: 2, stackHeight: 44, dryMethod: '日晒', grammage: 46, measuredGap: 0.82, deviation: calculateDeviation(0.82, gap2), schemaRev: 3, specRev: 1, specWireDiameter: 0.2, specStripeGap: 0.85, specMeshDensity: density(0.2, 0.85) },
  { id: 6, runNo: 'CB-260706', mouldId: 3, batchId: 2, runDate: daysAgo(10), operator: '汪知远', stripeDirection: '竖帘纹', dipCount: 1, stackHeight: 31, dryMethod: '火墙', grammage: 27, measuredGap: 0.94, deviation: calculateDeviation(0.94, gap3), schemaRev: 3, specRev: 1, specWireDiameter: 0.28, specStripeGap: 1.0, specMeshDensity: density(0.28, 1) },
  { id: 7, runNo: 'CB-260707', mouldId: 4, batchId: 1, runDate: daysAgo(17), operator: '林砚秋', stripeDirection: '横帘纹', dipCount: 2, stackHeight: 39, dryMethod: '日晒', grammage: 34, measuredGap: 1.5, deviation: calculateDeviation(1.5, 1.25), schemaRev: 3, specRev: 1, specWireDiameter: 0.32, specStripeGap: 1.25, specMeshDensity: density(0.32, 1.25) },
  { id: 8, runNo: 'CB-260708', mouldId: 5, batchId: 3, runDate: daysAgo(24), operator: '郭文山', stripeDirection: '竖帘纹', dipCount: 2, stackHeight: 46, dryMethod: '火墙', grammage: 44, measuredGap: 0.71, deviation: calculateDeviation(0.71, gap4), schemaRev: 3, specRev: 1, specWireDiameter: 0.18, specStripeGap: 0.72, specMeshDensity: density(0.18, 0.72) },
]

const seedSamples: PaperSample[] = [
  { id: 1, sampleNo: 'YZ-01', runId: 1, sizeMm: 210, stripeCount: 46, evenness: '均匀', archiveBin: '甲柜-03', schemaRev: 3, rechecked: true, archived: true, specRev: 2, recheckNote: '按 v2 规格复检合格' },
  { id: 2, sampleNo: 'YZ-02', runId: 2, sizeMm: 180, stripeCount: 52, evenness: '略花', archiveBin: '甲柜-07', schemaRev: 3, rechecked: true, archived: true, specRev: 1, recheckNote: '按 v1 规格复检合格' },
  { id: 3, sampleNo: 'YZ-03', runId: 3, sizeMm: 240, stripeCount: 39, evenness: '花', archiveBin: '待复检区', schemaRev: 3, rechecked: false, archived: false, specRev: 1, flaggedByRepairOrderNo: 'FX-260903' },
  { id: 4, sampleNo: 'YZ-04', runId: 4, sizeMm: 210, stripeCount: 31, evenness: '略花', archiveBin: '乙柜-05', schemaRev: 3, rechecked: true, archived: true, specRev: 2, recheckNote: '按 v2 规格复检合格' },
  { id: 5, sampleNo: 'YZ-05', runId: 5, sizeMm: 200, stripeCount: 48, evenness: '均匀', archiveBin: '甲柜-11', schemaRev: 3, rechecked: true, archived: true, specRev: 1, recheckNote: '按 v1 规格复检合格' },
  { id: 6, sampleNo: 'YZ-06', runId: 6, sizeMm: 260, stripeCount: 57, evenness: '均匀', archiveBin: '待复检区', schemaRev: 3, rechecked: false, archived: false, specRev: 1, flaggedByRepairOrderNo: 'FX-260903' },
]

// 返修单：一张已应用（DL-01 升到 v2）、一张待应用（DL-03，已标出待复检样本）、一张写入失败可重试（DL-04）
const seedRepairOrders: MouldRepairOrder[] = [
  {
    id: 1, orderNo: 'FX-260715', mouldId: 1, registeredAt: daysAgo(45), appliedAt: daysAgo(42), state: '已应用',
    reason: '原丝偏粗、帘纹偏疏，抄细密纸不匀；更换竹丝并加密帘距，应用后新工序按 v2 判定。',
    fromWireDiameter: 0.32, fromStripeGap: 1.25, fromMeshDensity: density(0.32, 1.25),
    toWireDiameter: 0.3, toStripeGap: 1.1, toMeshDensity: density(0.3, 1.1),
    wireMaterial: '竹丝', fromSpecRev: 1, toSpecRev: 2, flaggedSampleIds: [], schemaRev: 3,
  },
  {
    id: 2, orderNo: 'FX-260903', mouldId: 3, registeredAt: daysAgo(2), state: '待应用',
    reason: '中段三根帘丝磨损断丝，返修换丝并略加密间距，恢复帘纹均匀；应用前关联成纸样本须复检。',
    fromWireDiameter: 0.28, fromStripeGap: 1.0, fromMeshDensity: density(0.28, 1),
    toWireDiameter: 0.26, toStripeGap: 0.92, toMeshDensity: density(0.26, 0.92),
    wireMaterial: '竹丝', fromSpecRev: 1, toSpecRev: 2, flaggedSampleIds: [3, 6], schemaRev: 3,
  },
  {
    id: 3, orderNo: 'FX-260908', mouldId: 4, registeredAt: daysAgo(20), state: '失败',
    reason: '马尾丝老化松垂，返修剪丝重编并收紧间距。',
    fromWireDiameter: 0.32, fromStripeGap: 1.25, fromMeshDensity: density(0.32, 1.25),
    toWireDiameter: 0.3, toStripeGap: 1.15, toMeshDensity: density(0.3, 1.15),
    wireMaterial: '马尾丝', fromSpecRev: 1, toSpecRev: 2, flaggedSampleIds: [], schemaRev: 3,
    lastError: '上次写入时浏览器存储事务中止，纸帘原规格未改动，可重试。',
  },
]

class GbPaperMillDatabase extends Dexie {
  moulds!: Table<Mould, number>
  fiberBatches!: Table<FiberBatch, number>
  sheetRuns!: Table<SheetRun, number>
  paperSamples!: Table<PaperSample, number>
  repairOrders!: Table<MouldRepairOrder, number>

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
    // v3：纸帘规格版本化、返修单、工序/样本锁定各自规格版本
    this.version(3).stores({
      moulds: '++id,&mouldNo,state,wireMaterial,schemaRev,specRev',
      fiberBatches: '++id,&batchNo,material,beatingDegree,schemaRev',
      sheetRuns: '++id,&runNo,mouldId,batchId,runDate,operator,schemaRev,specRev',
      paperSamples: '++id,&sampleNo,runId,evenness,stripeCount,schemaRev,specRev,archived',
      repairOrders: '++id,&orderNo,mouldId,state,registeredAt',
    }).upgrade(async (transaction) => {
      const mouldsTable = transaction.table('moulds')
      const runsTable = transaction.table('sheetRuns')
      const samplesTable = transaction.table('paperSamples')

      // 纸帘台帐：保留当前规格，标记为 v1、初始来源
      await mouldsTable.toCollection().modify((mould: Record<string, unknown>) => {
        mould.schemaRev = 3
        mould.specRev = 1
        mould.specSource = { kind: 'initial' }
      })
      const mouldRows = await mouldsTable.toArray()
      const mouldById = new Map<number, Record<string, unknown>>()
      for (const row of mouldRows) mouldById.set(row.id as number, row)

      const runRows = await runsTable.toArray()
      const runById = new Map<number, Record<string, unknown>>()
      for (const row of runRows) runById.set(row.id as number, row)

      // 旧工序：按当时规格（即当前 v1）锁定快照，偏差继续按锁定间距判定
      await runsTable.toCollection().modify((run: Record<string, unknown>) => {
        run.schemaRev = 3
        const mould = mouldById.get(run.mouldId as number)
        run.specRev = (mould?.specRev as number | undefined) ?? 1
        run.specWireDiameter = (mould?.wireDiameter as number | undefined) ?? 0
        run.specStripeGap = (mould?.stripeGap as number | undefined) ?? 0
        run.specMeshDensity = (mould?.meshDensity as number | undefined) ?? 0
      })

      // 存量样本：锁定对应工序的规格版本，并视为已按当时规格复检归档，旧数据仍可读完
      await samplesTable.toCollection().modify((sample: Record<string, unknown>) => {
        sample.schemaRev = 3
        const run = runById.get(sample.runId as number)
        sample.specRev = (run?.specRev as number | undefined) ?? 1
        sample.rechecked = true
        sample.archived = true
      })

      await transaction.table('fiberBatches').toCollection().modify((value: Record<string, unknown>) => {
        value.schemaRev = 3
      })
    })
    this.on('populate', () => this.seed())
  }

  private async seed(): Promise<void> {
    await this.moulds.bulkAdd(plain(seedMoulds))
    await this.fiberBatches.bulkAdd(plain(seedBatches))
    await this.sheetRuns.bulkAdd(plain(seedRuns))
    await this.paperSamples.bulkAdd(plain(seedSamples))
    await this.repairOrders.bulkAdd(plain(seedRepairOrders))
  }
}

export const db = new GbPaperMillDatabase()
