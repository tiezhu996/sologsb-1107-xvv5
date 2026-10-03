import type { Mould } from '../types/mould'
import type { PaperSample } from '../types/paper-sample'
import type { SheetRun } from '../types/sheet-run'
import { calculateMeshDensity } from './stripe'

/** 一份不可变的纸帘规格快照 */
export interface MouldSpecSnapshot {
  specRev: number
  wireDiameter: number
  stripeGap: number
  meshDensity: number
}

export function snapshotOfMould(mould: Mould): MouldSpecSnapshot {
  return {
    specRev: mould.specRev ?? 1,
    wireDiameter: mould.wireDiameter,
    stripeGap: mould.stripeGap,
    meshDensity: mould.meshDensity,
  }
}

/** 工序登记时锁定规格 */
export function snapshotForRun(mould: Mould): Pick<
  SheetRun,
  'specRev' | 'specWireDiameter' | 'specStripeGap' | 'specMeshDensity'
> {
  return {
    specRev: mould.specRev ?? 1,
    specWireDiameter: mould.wireDiameter,
    specStripeGap: mould.stripeGap,
    specMeshDensity: mould.meshDensity,
  }
}

/** 工序版本标签：依据纸帘当前版本提示是否为旧版 */
export function runSpecLabel(run: Pick<SheetRun, 'specRev' | 'specStripeGap' | 'specWireDiameter'>, mould?: Pick<Mould, 'specRev'>): string {
  const current = mould ? mould.specRev ?? 1 : run.specRev ?? 1
  const rev = run.specRev ?? 1
  const stale = mould ? current > rev : false
  return `规格 v${rev}${stale ? '（旧版）' : ''} · 丝径 ${run.specWireDiameter?.toFixed(2) ?? '?'} mm · 标准间距 ${run.specStripeGap?.toFixed(2) ?? '?'} mm`
}

export function sampleSpecLabel(sample: Pick<PaperSample, 'specRev'>): string {
  return `规格 v${sample.specRev ?? 1}`
}

/** 计算拟改规格密度，保持与纸帘登记一致 */
export function proposedDensity(wireDiameter: number, stripeGap: number): number {
  return calculateMeshDensity(wireDiameter, stripeGap)
}
