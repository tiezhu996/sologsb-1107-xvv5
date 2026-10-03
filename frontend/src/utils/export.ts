import { db, plain } from './db'

export async function exportDatabaseJson(): Promise<string> {
  const [moulds, fiberBatches, sheetRuns, paperSamples, reworkOrders] = await Promise.all([
    db.moulds.toArray(),
    db.fiberBatches.toArray(),
    db.sheetRuns.toArray(),
    db.paperSamples.toArray(),
    db.reworkOrders.toArray(),
  ])
  const mouldById = new Map(moulds.map((mould) => [mould.id, mould]))
  // 逐条工序说明判定偏差所依据的纸帘规格版本，便于返修后核对
  const runSpecBasis = sheetRuns.map((run) => {
    const mould = mouldById.get(run.mouldId)
    const specRev = run.specRev ?? 1
    const specWireDiameter = run.specWireDiameter ?? mould?.wireDiameter ?? 0
    const specStripeGap = run.specStripeGap ?? mould?.stripeGap ?? 0
    return {
      runNo: run.runNo,
      mouldNo: mould?.mouldNo ?? '未关联纸帘',
      specRev,
      specWireDiameter,
      specStripeGap,
      basis: `工序 ${run.runNo} 依据纸帘 ${mould?.mouldNo ?? '未关联'} 规格 v${specRev}（丝径 ${specWireDiameter.toFixed(2)} mm，帘纹间距 ${specStripeGap.toFixed(2)} mm）判定偏差`,
    }
  })
  const filename = `gbpapermill-backup-${new Date().toISOString().slice(0, 10)}.json`
  const backup = plain({
    database: 'gbpapermill-db',
    version: 3,
    exportedAt: new Date().toISOString(),
    moulds,
    fiberBatches,
    sheetRuns,
    paperSamples,
    reworkOrders,
    runSpecBasis,
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
