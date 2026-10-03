import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { GrainStripePreview } from '../components/common/GrainStripePreview'
import { RulerInput } from '../components/common/RulerInput'
import { useMouldFilter } from '../hooks/useMouldFilter'
import { useUnitConvert } from '../hooks/useUnitConvert'
import { useMouldStore } from '../stores/mouldStore'
import { useRepairOrderStore } from '../stores/repairOrderStore'
import { useRunStore } from '../stores/runStore'
import { useSampleStore } from '../stores/sampleStore'
import { MOULD_STATES, WIRE_MATERIALS, type Mould, type MouldInput, type MouldStateValue, type WireMaterial } from '../types/mould'
import type { RepairOrderDraft } from '../types/repair-order'
import { calculateMeshDensity } from '../utils/stripe'

const emptyMouldForm: MouldInput = {
  mouldNo: '',
  frameW: 60,
  frameH: 90,
  wireMaterial: '竹丝',
  wireDiameter: 0.3,
  stripeGap: 1.1,
  meshDensity: calculateMeshDensity(0.3, 1.1),
  weaver: '周守良',
  state: '在用',
  specRev: 1,
  specSource: { kind: 'initial' },
}

function nextRepairOrderNo(): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const suffix = String(now.getHours() * 60 + now.getMinutes()).padStart(3, '0')
  return `FX-${ymd}${suffix}`
}

export default function MouldLedger() {
  const moulds = useMouldStore((state) => state.moulds)
  const error = useMouldStore((state) => state.error)
  const loadMoulds = useMouldStore((state) => state.loadMoulds)
  const addMould = useMouldStore((state) => state.addMould)
  const runs = useRunStore((state) => state.sheetRuns)
  const loadRuns = useRunStore((state) => state.loadRuns)
  const repairOrders = useRepairOrderStore((state) => state.repairOrders)
  const repairError = useRepairOrderStore((state) => state.error)
  const loadRepairOrders = useRepairOrderStore((state) => state.loadRepairOrders)
  const registerRepairOrder = useRepairOrderStore((state) => state.registerRepairOrder)
  const applyRepairOrder = useRepairOrderStore((state) => state.applyRepairOrder)
  const samples = useSampleStore((state) => state.paperSamples)
  const loadSamples = useSampleStore((state) => state.loadSamples)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MouldInput>(emptyMouldForm)
  const [submitting, setSubmitting] = useState(false)
  const [repairMould, setRepairMould] = useState<Mould | null>(null)
  const [repairSubmitting, setRepairSubmitting] = useState(false)
  const [repairMessage, setRepairMessage] = useState('')
  const { mmPitchToThreadsPerCm } = useUnitConvert()
  const {
    mouldNo,
    state: stateFilter,
    wireMaterial,
    filteredMoulds,
    setMouldNo,
    setState,
    setWireMaterial,
    resetFilters,
  } = useMouldFilter(moulds)

  useEffect(() => {
    void loadMoulds()
    void loadRuns()
    void loadRepairOrders()
    void loadSamples()
  }, [loadMoulds, loadRuns, loadRepairOrders, loadSamples])

  const calculatedDensity = useMemo(
    () => calculateMeshDensity(form.wireDiameter, form.stripeGap),
    [form.stripeGap, form.wireDiameter],
  )

  const ordersByMould = useMemo(() => {
    const map = new Map<number, typeof repairOrders>()
    for (const order of repairOrders) {
      const list = map.get(order.mouldId) ?? []
      list.push(order)
      map.set(order.mouldId, list)
    }
    return map
  }, [repairOrders])

  const pendingCountForMould = (mouldId?: number) =>
    mouldId === undefined ? 0 : repairOrders.filter((order) => order.mouldId === mouldId && order.state === '待应用').length

  const updateForm = <K extends keyof MouldInput,>(key: K, value: MouldInput[K]) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      next.meshDensity = calculateMeshDensity(next.wireDiameter, next.stripeGap)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!form.mouldNo.trim() || !form.weaver.trim() || form.frameW <= 0 || form.frameH <= 0 || form.wireDiameter <= 0 || form.stripeGap <= 0) return
    setSubmitting(true)
    const created = await addMould({ ...form, mouldNo: form.mouldNo.trim(), weaver: form.weaver.trim(), meshDensity: calculatedDensity })
    setSubmitting(false)
    if (created) {
      setForm(emptyMouldForm)
      setShowForm(false)
    }
  }

  const openRepair = (mould: Mould) => {
    setRepairMould(mould)
    setRepairMessage('')
  }

  const closeRepair = () => {
    if (repairSubmitting) return
    setRepairMould(null)
    setRepairMessage('')
  }

  const handleApply = async (id: number) => {
    const ok = await applyRepairOrder(id)
    if (ok) {
      await Promise.all([loadMoulds(true), loadRepairOrders(true)])
    }
  }

  const displayedError = error ?? repairError

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Typography component="h1" variant="h3" color="#344a34">纸帘台帐</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>台帐仅保留纸帘当前规格；返修通过可核对的返修单登记，应用后版本号递增。</Typography>
        </Box>
        <Button variant="contained" size="large" onClick={() => setShowForm((current) => !current)} data-testid="new-mould">
          {showForm ? '收起登记' : '新建纸帘'}
        </Button>
      </Box>

      {displayedError && <Alert severity="warning">{displayedError}</Alert>}

      {showForm && (
        <Card data-testid="form-mould" sx={{ borderColor: '#9eb096' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h5">登记新纸帘</Typography>
                <Typography variant="body2" color="text.secondary">新纸帘当前规格为 v1（初始来源）；丝径或间距变化时密度即时重算。</Typography>
              </Box>
              <Chip color="success" label={`${calculatedDensity.toFixed(1)} 根/厘米`} />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="纸帘编号" value={form.mouldNo} onChange={(event) => updateForm('mouldNo', event.target.value)} inputProps={{ 'data-testid': 'field-mouldNo' }} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth type="number" label="帘框宽" value={form.frameW} onChange={(event) => updateForm('frameW', Number(event.target.value))} inputProps={{ min: 1, step: 1, 'data-testid': 'field-frameW' }} InputProps={{ endAdornment: 'cm' }} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth type="number" label="帘框高" value={form.frameH} onChange={(event) => updateForm('frameH', Number(event.target.value))} inputProps={{ min: 1, step: 1, 'data-testid': 'field-frameH' }} InputProps={{ endAdornment: 'cm' }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="帘丝材质"
                  value={form.wireMaterial}
                  onChange={(event) => updateForm('wireMaterial', event.target.value as WireMaterial)}
                  SelectProps={{ native: true, inputProps: { 'data-testid': 'field-wireMaterial' } }}
                >
                  {WIRE_MATERIALS.map((option) => <option key={option} value={option}>{option}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <RulerInput label="丝径" value={form.wireDiameter} onChange={(value) => updateForm('wireDiameter', value)} min={0.05} max={2} step={0.01} testId="field-wireDiameter" />
              </Grid>
              <Grid item xs={12} md={4}>
                <RulerInput label="帘纹间距" value={form.stripeGap} onChange={(value) => updateForm('stripeGap', value)} min={0.1} max={5} step={0.01} testId="field-stripeGap" />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="编帘匠人" value={form.weaver} onChange={(event) => updateForm('weaver', event.target.value)} inputProps={{ 'data-testid': 'field-weaver' }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="状态"
                  value={form.state}
                  onChange={(event) => updateForm('state', event.target.value as MouldStateValue)}
                  SelectProps={{ native: true, inputProps: { 'data-testid': 'field-state' } }}
                >
                  {MOULD_STATES.map((option) => <option key={option} value={option}>{option}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={8} sx={{ display: 'flex', alignItems: 'stretch' }}>
                <Box sx={{ width: '100%' }}>
                  <GrainStripePreview gap={form.stripeGap} wireDiameter={form.wireDiameter} density={calculatedDensity} direction={form.wireMaterial === '马尾丝' ? 'horizontal' : 'vertical'} />
                </Box>
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
              <Button onClick={() => setShowForm(false)}>取消</Button>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting} data-testid="submit-mould">
                保存纸帘
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="筛选帘号" value={mouldNo} onChange={(event) => setMouldNo(event.target.value)} />
            </Grid>
            <Grid item xs={6} md={2.5}>
              <TextField select fullWidth size="small" label="状态" value={stateFilter} onChange={(event) => setState(event.target.value as MouldStateValue | '全部')} SelectProps={{ native: true }}>
                <option value="全部">全部</option>
                {MOULD_STATES.map((option) => <option key={option} value={option}>{option}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={6} md={2.5}>
              <TextField select fullWidth size="small" label="帘丝材质" value={wireMaterial} onChange={(event) => setWireMaterial(event.target.value as WireMaterial | '全部')} SelectProps={{ native: true }}>
                <option value="全部">全部</option>
                {WIRE_MATERIALS.map((option) => <option key={option} value={option}>{option}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Typography variant="body2" color="text.secondary">当前记录</Typography>
                <Typography variant="h5" data-testid="count-mould">{filteredMoulds.length}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" onClick={resetFilters}>重置筛选</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Card}>
        <Table sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow>
              <TableCell>帘号 / 尺寸</TableCell>
              <TableCell>材质与丝径（当前）</TableCell>
              <TableCell>间距 / 密度（当前）</TableCell>
              <TableCell>编帘匠人</TableCell>
              <TableCell>工序 / 返修单</TableCell>
              <TableCell>状态 / 版本</TableCell>
              <TableCell align="right">返修操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMoulds.map((mould) => {
              const relatedRuns = runs.filter((run) => run.mouldId === mould.id)
              const latestRun = relatedRuns[0]
              const mouldOrders = ordersByMould.get(mould.id ?? -1) ?? []
              return (
                <TableRow key={mould.id ?? mould.mouldNo} data-testid="row-mould" hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 750 }}>{mould.mouldNo}</Typography>
                    <Typography variant="caption" color="text.secondary">{mould.frameW} × {mould.frameH} cm · {(mould.frameW * mould.frameH / 10000).toFixed(3)} 平方米</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={mould.wireMaterial} variant="outlined" />
                    <Typography variant="body2" sx={{ mt: 0.6 }}>{mould.wireDiameter.toFixed(2)} mm</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography>{mould.stripeGap.toFixed(2)} mm</Typography>
                    <Typography variant="caption" color="text.secondary">{mould.meshDensity.toFixed(1)} 根/cm · 推算 {mmPitchToThreadsPerCm(mould.wireDiameter + mould.stripeGap).toFixed(1)}</Typography>
                  </TableCell>
                  <TableCell>{mould.weaver}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{relatedRuns.length} 槽工序</Typography>
                    <Typography variant="caption" color="text.secondary">{latestRun ? `最近 ${latestRun.runDate}` : '尚无关联'}</Typography>
                    {mouldOrders.length > 0 && (
                      <Typography variant="caption" display="block" color="text.secondary">返修单 {mouldOrders.length} 张</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={mould.state === '在用' ? 'success' : mould.state === '待修补' ? 'warning' : 'default'} label={mould.state} />
                    <Box sx={{ mt: 0.6 }}>
                      <Chip size="small" variant="outlined" color="primary" label={`当前规格 v${mould.specRev}`} data-testid={`specrev-${mould.id}`} />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant={pendingCountForMould(mould.id) > 0 || mould.state === '待修补' ? 'contained' : 'outlined'}
                      disabled={mould.state === '退役' || mould.id === undefined}
                      onClick={() => openRepair(mould)}
                      data-testid={`repair-${mould.id}`}
                    >
                      {pendingCountForMould(mould.id) > 0 ? '查看/登记返修单' : '登记返修单'}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredMoulds.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>没有符合筛选条件的纸帘</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <RepairOrderCard
        orders={repairOrders}
        moulds={moulds}
        samples={samples}
        onApply={handleApply}
      />

      <RepairOrderDialog
        mould={repairMould}
        hasPending={repairMould ? pendingCountForMould(repairMould.id) > 0 : false}
        submitting={repairSubmitting}
        message={repairMessage}
        onClose={closeRepair}
        onSubmit={async (draft, mould) => {
          setRepairSubmitting(true)
          const result = await registerRepairOrder(draft, mould)
          setRepairSubmitting(false)
          if (result) {
            await Promise.all([loadMoulds(true), loadRepairOrders(true), loadSamples(true)])
            const flagged = result.affectedSamples.length
            setRepairMessage(flagged
              ? `返修单 ${draft.orderNo} 已登记：${flagged} 个成纸样本已标出“待复检”，应用前需复检。`
              : `返修单 ${draft.orderNo} 已登记，尚无待复检样本。`)
            return true
          }
          setRepairMessage(repairError ?? '登记失败，原数据保留，可重试')
          return false
        }}
      />
    </Stack>
  )
}

interface RepairOrderCardProps {
  orders: import('../types/repair-order').MouldRepairOrder[]
  moulds: Mould[]
  samples: import('../types/paper-sample').PaperSample[]
  onApply: (id: number) => void
}

function RepairOrderCard({ orders, moulds, samples, onApply }: RepairOrderCardProps) {
  const mouldById = useMemo(() => new Map(moulds.map((mould) => [mould.id, mould])), [moulds])
  const sampleById = useMemo(() => new Map(samples.map((sample) => [sample.id, sample])), [samples])
  const sorted = useMemo(
    () => [...orders].sort((a, b) => (b.registeredAt.localeCompare(a.registeredAt))),
    [orders],
  )

  return (
    <Card data-testid="repair-orders">
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h5">纸帘返修单</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          每张单写明拟改规格与原因，并保留原规格快照可核对；旧工序仍按锁定的旧版本判定，应用后的新工序才用新版本。
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>返修单号 / 帘号</TableCell>
              <TableCell>原规格 → 拟改规格</TableCell>
              <TableCell>原因</TableCell>
              <TableCell>待复检样本</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">应用</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((order) => {
              const mould = mouldById.get(order.mouldId)
              const changedWire = order.fromWireDiameter !== order.toWireDiameter
              const changedGap = order.fromStripeGap !== order.toStripeGap
              const flagged = order.flaggedSampleIds.map((sid) => sampleById.get(sid)).filter(Boolean)
              return (
                <TableRow key={order.id ?? order.orderNo} data-testid={`repair-row-${order.id}`} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700 }}>{order.orderNo}</Typography>
                    <Typography variant="caption" color="text.secondary">{mould?.mouldNo ?? '纸帘缺失'} · {order.registeredAt}{order.appliedAt ? ` 应用于 ${order.appliedAt}` : ''}</Typography>
                    <Box sx={{ mt: 0.5 }}><Chip size="small" variant="outlined" label={`规格 v${order.fromSpecRev} → v${order.toSpecRev}`} /></Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={changedWire ? 'warning.dark' : 'text.secondary'}>
                      丝径 {order.fromWireDiameter.toFixed(2)} → {order.toWireDiameter.toFixed(2)} mm
                    </Typography>
                    <Typography variant="body2" color={changedGap ? 'warning.dark' : 'text.secondary'}>
                      间距 {order.fromStripeGap.toFixed(2)} → {order.toStripeGap.toFixed(2)} mm
                    </Typography>
                    <Typography variant="caption" color="text.secondary">密度 {order.fromMeshDensity.toFixed(1)} → {order.toMeshDensity.toFixed(1)} 根/cm</Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    <Typography variant="body2">{order.reason}</Typography>
                    {order.lastError && <Alert severity="error" sx={{ mt: 0.5, py: 0 }}>{order.lastError}</Alert>}
                  </TableCell>
                  <TableCell>
                    {flagged.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">无</Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {flagged.map((sample) => (
                          <Chip
                            key={sample!.id}
                            size="small"
                            color={sample!.rechecked ? 'success' : 'warning'}
                            variant={sample!.rechecked ? 'outlined' : 'filled'}
                            label={`${sample!.sampleNo} ${sample!.rechecked ? '已复检' : '待复检'}`}
                          />
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={order.state === '已应用' ? 'success' : order.state === '失败' ? 'error' : 'warning'} label={order.state} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      color={order.state === '失败' ? 'error' : 'primary'}
                      disabled={order.state === '已应用'}
                      onClick={() => onApply(order.id as number)}
                      data-testid={`apply-repair-${order.id}`}
                    >
                      {order.state === '失败' ? '重试应用' : '应用规格'}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>尚无返修单</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

interface RepairOrderDialogProps {
  mould: Mould | null
  hasPending: boolean
  submitting: boolean
  message: string
  onClose: () => void
  onSubmit: (draft: RepairOrderDraft, mould: Mould) => Promise<boolean>
}

function RepairOrderDialog({ mould, hasPending, submitting, message, onClose, onSubmit }: RepairOrderDialogProps) {
  const [draft, setDraft] = useState<RepairOrderDraft>({
    orderNo: nextRepairOrderNo(),
    mouldId: 0,
    registeredAt: new Date().toISOString().slice(0, 10),
    reason: '',
    toWireDiameter: 0,
    toStripeGap: 0,
  })

  useEffect(() => {
    if (mould) {
      setDraft({
        orderNo: nextRepairOrderNo(),
        mouldId: mould.id ?? 0,
        registeredAt: new Date().toISOString().slice(0, 10),
        reason: '',
        toWireDiameter: mould.wireDiameter,
        toStripeGap: mould.stripeGap,
      })
    }
  }, [mould])

  if (!mould) return null

  const proposedMesh = calculateMeshDensity(draft.toWireDiameter, draft.toStripeGap)
  const changedWire = draft.toWireDiameter !== mould.wireDiameter
  const changedGap = draft.toStripeGap !== mould.stripeGap
  const valid =
    draft.orderNo.trim() !== '' &&
    draft.reason.trim() !== '' &&
    draft.toWireDiameter > 0 &&
    draft.toStripeGap > 0 &&
    (changedWire || changedGap)

  return (
    <Dialog open={Boolean(mould)} onClose={onClose} maxWidth="sm" fullWidth data-testid="repair-dialog">
      <DialogTitle>
        登记返修单 · {mould.mouldNo}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          当前规格 v{mould.specRev}；登记后纸帘置“待修补”，关联待复检样本会被标出。
        </Typography>
      </DialogTitle>
      <DialogContent>
        {hasPending && (
          <Alert severity="info" sx={{ mb: 2 }}>该纸帘已有待应用返修单；新登记前请先应用或处理原单。</Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="返修单号" value={draft.orderNo} onChange={(event) => setDraft((d) => ({ ...d, orderNo: event.target.value }))} inputProps={{ 'data-testid': 'repair-field-orderNo' }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth type="date" label="送修日期" value={draft.registeredAt} onChange={(event) => setDraft((d) => ({ ...d, registeredAt: event.target.value }))} InputLabelProps={{ shrink: true }} inputProps={{ 'data-testid': 'repair-field-date' }} />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="返修原因（必填）"
              value={draft.reason}
              onChange={(event) => setDraft((d) => ({ ...d, reason: event.target.value }))}
              inputProps={{ 'data-testid': 'repair-field-reason' }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <RulerInput
              label={`拟改丝径（原 ${mould.wireDiameter.toFixed(2)} mm）`}
              value={draft.toWireDiameter}
              onChange={(value) => setDraft((d) => ({ ...d, toWireDiameter: value }))}
              min={0.05}
              max={2}
              step={0.01}
              testId="repair-field-wire"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <RulerInput
              label={`拟改帘纹间距（原 ${mould.stripeGap.toFixed(2)} mm）`}
              value={draft.toStripeGap}
              onChange={(value) => setDraft((d) => ({ ...d, toStripeGap: value }))}
              min={0.1}
              max={5}
              step={0.01}
              testId="repair-field-gap"
            />
          </Grid>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ bgcolor: '#f7f4ea' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2">
                  拟改后密度 {proposedMesh.toFixed(1)} 根/cm（原 {mould.meshDensity.toFixed(1)} 根/cm）
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  应用后纸帘当前规格升为 v{(mould.specRev ?? 1) + 1}；此前工序与样本仍锁定 v{mould.specRev ?? 1}，偏差按旧标准判定。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        {message && <Alert severity={message.includes('失败') ? 'error' : 'success'} sx={{ mt: 2 }}>{message}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>{message && !message.includes('失败') ? '完成' : '取消'}</Button>
        <Button
          variant="contained"
          disabled={!valid || submitting || hasPending}
          onClick={async () => {
            const ok = await onSubmit({ ...draft, orderNo: draft.orderNo.trim(), reason: draft.reason.trim() }, mould)
            if (!ok) return
          }}
          data-testid="submit-repair"
        >
          {submitting ? '写入中…' : '登记返修单'}
        </Button>
      </DialogActions>
      <Divider />
    </Dialog>
  )
}
