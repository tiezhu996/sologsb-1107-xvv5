import type { Mould } from '../types/mould'
import type { PaperSample } from '../types/paper-sample'
import type { SheetRun } from '../types/sheet-run'
import { CURRENT_SCHEMA_REV, db, plain } from './db'

/** 为每条工序生成人类可读的“依据版本”说明 */
export function runSpecBasis(run: SheetRun, mould?: Mould): string {
  const current = mould ? mould.specRev ?? 1 : run.specRev ?? 1
  const rev = run.specRev ?? 1
  const stale = mould ? current > rev : false
  const source = mould?.specSource.kind === 'repair' ? `，纸帘当前 v${current}（返修单 ${mould.specSource.repairOrderNo}）` : mould ? `，纸帘当前 v${current}` : ''
  return `依据规格 v${rev}${stale ? '（返修前旧版）' : ''}：丝径 ${run.specWireDiameter?.toFixed(2) ?? '?'} mm、标准帘纹间距 ${run.specStripeGap?.toFixed(2) ?? '?'} mm，偏差按该版本判定${source}`
}

/** 为每条样本标注其锁定的规格版本与复检/归档状态 */
export function sampleSpecBasis(sample: PaperSample, run?: SheetRun): string {
  const rev = sample.specRev ?? run?.specRev ?? 1
  const recheck = sample.rechecked ? '已复检' : '未复检（须复检后方可归档）'
  const archive = sample.archived ? `已归档 ${sample.archiveBin}` : '未归档'
  return `依据规格 v${rev}（随工序 ${run?.runNo ?? '待关联'}）；${recheck}；${archive}`
}

export async function exportDatabaseJson(): Promise<string> {
  const [moulds, fiberBatches, sheetRuns, paperSamples, repairOrders] = await Promise.all([
    db.moulds.toArray(),
    db.fiberBatches.toArray(),
    db.sheetRuns.toArray(),
    db.paperSamples.toArray(),
    db.repairOrders.toArray(),
  ])
  const mouldById = new Map<number, Mould>(moulds.map((mould) => [mould.id as number, mould]))
  const runById = new Map<number, SheetRun>(sheetRuns.map((run) => [run.id as number, run]))

  // 备份中显式说明每条工序、每个样本依据的规格版本
  const sheetRunsWithBasis = sheetRuns.map((run) => ({
    ...run,
    specBasis: runSpecBasis(run, mouldById.get(run.mouldId)),
  }))
  const paperSamplesWithBasis = paperSamples.map((sample) => ({
    ...sample,
    specBasis: sampleSpecBasis(sample, runById.get(sample.runId)),
  }))

  const filename = `gbpapermill-backup-${new Date().toISOString().slice(0, 10)}.json`
  const backup = plain({
    database: 'gbpapermill-db',
    version: CURRENT_SCHEMA_REV,
    exportedAt: new Date().toISOString(),
    note: '旧工序与成纸样本锁定登记当时的规格版本，纸帘台帐仅保留当前规格；返修单应用后新工序才用新版本。',
    moulds,
    fiberBatches,
    repairOrders,
    sheetRuns: sheetRunsWithBasis,
    paperSamples: paperSamplesWithBasis,
  })
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
  return filename
}
