import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, Stack, TextField, Typography } from '@mui/material'
import { useMouldStore } from '../../stores/mouldStore'
import { useReworkStore } from '../../stores/reworkStore'
import { useRunStore } from '../../stores/runStore'
import { useSampleStore } from '../../stores/sampleStore'
import type { ReworkOrder } from '../../types/rework-order'
import { calculateMeshDensity } from '../../utils/stripe'
import { GrainStripePreview } from '../common/GrainStripePreview'
import { RulerInput } from '../common/RulerInput'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function suggestOrderNo(orders: ReworkOrder[]): string {
  const maxSeq = orders.reduce((max, order) => {
    const match = /(\d+)$/.exec(order.orderNo)
    return match ? Math.max(max, Number(match[1])) : max
  }, 2600)
  return `FX-${maxSeq + 1}`
}

function stateChipColor(state: ReworkOrder['state']): 'warning' | 'success' | 'default' {
  if (state === '待应用') return 'warning'
  if (state === '已应用') return 'success'
  return 'default'
}

interface ReworkOrderBoardProps {
  formMouldId: number | null
  onCloseForm: () => void
}

export function ReworkOrderBoard({ formMouldId, onCloseForm }: ReworkOrderBoardProps) {
  const moulds = useMouldStore((state) => state.moulds)
  const runs = useRunStore((state) => state.sheetRuns)
  const loadRuns = useRunStore((state) => state.loadRuns)
  const samples = useSampleStore((state) => state.paperSamples)
  const loadSamples = useSampleStore((state) => state.loadSamples)
  const reworkOrders = useReworkStore((state) => state.reworkOrders)
  const reworkError = useReworkStore((state) => state.error)
  const loadReworkOrders = useReworkStore((state) => state.loadReworkOrders)
  const addReworkOrder = useReworkStore((state) => state.addReworkOrder)
  const applyReworkOrder = useReworkStore((state) => state.applyReworkOrder)
  const cancelReworkOrder = useReworkStore((state) => state.cancelReworkOrder)

  const [orderNo, setOrderNo] = useState('')
  const [mouldId, setMouldId] = useState(0)
  const [nextWireDiameter, setNextWireDiameter] = useState(0.3)
  const [nextStripeGap, setNextStripeGap] = useState(1)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [applyingId, setApplyingId] = useState<number | null>(null)
  const [applyMessage, setApplyMessage] = useState('')

  useEffect(() => {
    void loadReworkOrders()
    void loadRuns()
    void loadSamples()
  }, [loadReworkOrders, loadRuns, loadSamples])

  const mouldById = useMemo(() => new Map(moulds.map((mould) => [mould.id, mould])), [moulds])
  const runIdsByMould = useMemo(() => {
    const map = new Map<number, Set<number>>()
    for (const run of runs) {
      if (run.id === undefined) continue
      const set = map.get(run.mouldId) ?? new Set<number>()
      set.add(run.id)
      map.set(run.mouldId, set)
    }
    return map
  }, [runs])

  const pendingFlagCount = (order: ReworkOrder): number => {
    const runIds = runIdsByMould.get(order.mouldId)
    if (!runIds) return 0
    return samples.filter(
      (sample) =>
        runIds.has(sample.runId) &&
        (sample.recheckState ?? '未复检') !== '已复检' &&
        (sample.archiveState ?? '待归档') !== '已归档',
    ).length
  }

  const presetForMould = (id: number) => {
    const mould = mouldById.get(id)
    setMouldId(id)
    setNextWireDiameter(mould?.wireDiameter ?? 0.3)
    setNextStripeGap(mould?.stripeGap ?? 1)
  }

  useEffect(() => {
    if (formMouldId !== null) {
      presetForMould(formMouldId)
      setOrderNo(suggestOrderNo(reworkOrders))
      setReason('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formMouldId])

  const formMould = mouldById.get(mouldId)
  const nextMeshDensity = calculateMeshDensity(nextWireDiameter, nextStripeGap)
  const specChanged = Boolean(formMould) && (nextWireDiameter !== formMould?.wireDiameter || nextStripeGap !== formMould?.stripeGap)
  const canSubmit =
    Boolean(formMould) && orderNo.trim().length > 0 && reason.trim().length > 0 && nextWireDiameter > 0 && nextStripeGap > 0 && specChanged

  const handleSubmit = async () => {
    if (!formMould || !canSubmit) return
    setSubmitting(true)
    const created = await addReworkOrder({
      orderNo: orderNo.trim(),
      mouldId: formMould.id as number,
      reason: reason.trim(),
      prevSpecRev: formMould.specRev ?? 1,
      prevWireDiameter: formMould.wireDiameter,
      prevStripeGap: formMould.stripeGap,
      prevMeshDensity: formMould.meshDensity,
      nextWireDiameter,
      nextStripeGap,
      nextMeshDensity,
      createdAt: todayIso(),
    })
    setSubmitting(false)
    if (created) onCloseForm()
  }

  const handleApply = async (order: ReworkOrder) => {
    if (order.id === undefined) return
    setApplyingId(order.id)
    setApplyMessage('')
    const applied = await applyReworkOrder(order.id)
    setApplyingId(null)
    if (applied) {
      const mouldNo = mouldById.get(applied.mouldId)?.mouldNo ?? '未知纸帘'
      setApplyMessage(
        `返修单 ${applied.orderNo} 已应用：${mouldNo} 现行规格升为 v${applied.prevSpecRev + 1}，标出 ${applied.flaggedSampleIds.length} 个样本待复检，复检后才能归档。`,
      )
    }
  }

  return (
    <Stack spacing={2.5} data-testid="rework-board">
      {formMouldId !== null && (
        <Card data-testid="form-rework" sx={{ borderColor: '#c9a15f' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
              <Box>
                <Typography variant="h5">登记返修单</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  写清拟改规格与原因；应用前会标出未复检样本，既有工序仍按当时规格判定。
                </Typography>
              </Box>
              {formMould && (
                <Chip
                  color="warning"
                  variant="outlined"
                  label={`当前规格 v${formMould.specRev ?? 1} · 丝径 ${formMould.wireDiameter.toFixed(2)} mm · 间距 ${formMould.stripeGap.toFixed(2)} mm · ${formMould.meshDensity.toFixed(1)} 根/cm`}
                />
              )}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="返修单号" value={orderNo} onChange={(event) => setOrderNo(event.target.value)} inputProps={{ 'data-testid': 'field-orderNo' }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  label="返修纸帘"
                  value={mouldId}
                  onChange={(event) => presetForMould(Number(event.target.value))}
                  SelectProps={{ native: true, inputProps: { 'data-testid': 'field-reworkMouldId' } }}
                >
                  {moulds.filter((mould) => mould.state !== '退役').map((mould) => (
                    <option key={mould.id} value={mould.id}>
                      {mould.mouldNo} · 现行 v{mould.specRev ?? 1}
                    </option>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <RulerInput label="拟改丝径" value={nextWireDiameter} onChange={setNextWireDiameter} min={0.05} max={2} step={0.01} testId="field-nextWireDiameter" />
              </Grid>
              <Grid item xs={12} md={3}>
                <RulerInput label="拟改帘纹间距" value={nextStripeGap} onChange={setNextStripeGap} min={0.1} max={5} step={0.01} testId="field-nextStripeGap" />
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="返修原因"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="例如：帘边断丝、丝面起毛，需换丝重织并调整帘纹间距"
                  inputProps={{ 'data-testid': 'field-reason' }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <GrainStripePreview gap={nextStripeGap} wireDiameter={nextWireDiameter} density={nextMeshDensity} direction={formMould?.wireMaterial === '马尾丝' ? 'horizontal' : 'vertical'} />
              </Grid>
            </Grid>
            {!specChanged && formMould && (
              <Alert severity="info" sx={{ mt: 2 }}>
                拟改规格与当前规格一致，返修单需至少改动丝径或帘纹间距。
              </Alert>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
              <Button onClick={onCloseForm}>取消</Button>
              <Button variant="contained" color="warning" onClick={handleSubmit} disabled={submitting || !canSubmit} data-testid="submit-rework">
                保存返修单
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
            <Box>
              <Typography variant="h5">返修单</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                返修单记录拟改规格与原因；应用时标出未复检样本并切换纸帘现行规格，失败可重试且原数据保留。
              </Typography>
            </Box>
            <Chip label={`${reworkOrders.length} 单`} variant="outlined" />
          </Box>

          {reworkError && <Alert severity="warning" sx={{ mb: 2 }}>{reworkError}</Alert>}
          {applyMessage && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setApplyMessage('')}>
              {applyMessage}
            </Alert>
          )}

          <Stack spacing={2}>
            {reworkOrders.map((order) => {
              const mould = mouldById.get(order.mouldId)
              const flagCount = order.state === '待应用' ? pendingFlagCount(order) : 0
              return (
                <Box
                  key={order.id ?? order.orderNo}
                  data-testid="row-rework-order"
                  sx={{ border: '1px solid #ddd2b8', borderRadius: 2, p: 2, bgcolor: order.state === '待应用' ? '#fffaf0' : '#faf7ef' }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 1.5, flexDirection: { xs: 'column', md: 'row' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 800 }}>{order.orderNo}</Typography>
                      <Chip size="small" color={stateChipColor(order.state)} label={order.state} />
                      <Chip size="small" variant="outlined" label={mould?.mouldNo ?? '纸帘已删除'} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      登记 {order.createdAt}
                      {order.appliedAt ? ` · 应用 ${order.appliedAt.slice(0, 10)}` : ''}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={7}>
                      <Typography variant="body2" sx={{ fontWeight: 650 }}>
                        拟改规格：丝径 {order.prevWireDiameter.toFixed(2)} → {order.nextWireDiameter.toFixed(2)} mm · 间距 {order.prevStripeGap.toFixed(2)} → {order.nextStripeGap.toFixed(2)} mm
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        密度 {order.prevMeshDensity.toFixed(1)} → {order.nextMeshDensity.toFixed(1)} 根/cm · 规格版本 v{order.prevSpecRev} → v{order.prevSpecRev + 1}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        原因：{order.reason}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={5}>
                      {order.state === '待应用' && (
                        <Alert severity={flagCount > 0 ? 'warning' : 'info'} icon={false} sx={{ py: 0.5 }}>
                          应用时将标出 {flagCount} 个未复检样本，复检后才能归档
                        </Alert>
                      )}
                      {order.state === '已应用' && (
                        <Alert severity="success" icon={false} sx={{ py: 0.5 }}>
                          已标出 {order.flaggedSampleIds.length} 个样本待复检；新工序按 v{order.prevSpecRev + 1} 判定
                        </Alert>
                      )}
                      {order.state === '已作废' && (
                        <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                          返修单已作废，纸帘规格未改动
                        </Alert>
                      )}
                    </Grid>
                  </Grid>
                  {order.state === '待应用' && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1.5 }}>
                      <Button size="small" variant="outlined" color="inherit" disabled={order.id === undefined || applyingId !== null} onClick={() => order.id !== undefined && void cancelReworkOrder(order.id)}>
                        作废
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        disabled={order.id === undefined || applyingId !== null}
                        onClick={() => void handleApply(order)}
                        data-testid={order.id === undefined ? undefined : `apply-rework-${order.id}`}
                      >
                        {applyingId === order.id ? '应用中…' : '应用返修单'}
                      </Button>
                    </Box>
                  )}
                </Box>
              )
            })}
            {reworkOrders.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                尚无返修单，在上方纸帘行点“登记返修”即可开立。
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
