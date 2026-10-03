import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, TextField, Typography } from '@mui/material'
import { GrainStripePreview } from '../components/common/GrainStripePreview'
import { RulerInput } from '../components/common/RulerInput'
import { StatBadge } from '../components/common/StatBadge'
import { useUnitConvert } from '../hooks/useUnitConvert'
import { useMouldStore } from '../stores/mouldStore'
import { useRunStore } from '../stores/runStore'
import { useSampleStore } from '../stores/sampleStore'
import { EVENNESS_LEVELS, type EvennessLevel, type PaperSample, type PaperSampleInput } from '../types/paper-sample'
import { isGapOutOfTolerance } from '../utils/stripe'

const emptySampleForm: PaperSampleInput = {
  sampleNo: '',
  runId: 1,
  sizeMm: 210,
  stripeCount: 45,
  evenness: '均匀',
  archiveBin: '待复检区',
}

function stripeTier(count: number): { label: string; color: 'success' | 'info' | 'warning' } {
  if (count >= 50) return { label: '密纹档', color: 'success' }
  if (count >= 40) return { label: '中密档', color: 'info' }
  return { label: '疏纹档', color: 'warning' }
}

export default function SampleCards() {
  const samples = useSampleStore((state) => state.paperSamples)
  const error = useSampleStore((state) => state.error)
  const loadSamples = useSampleStore((state) => state.loadSamples)
  const addSample = useSampleStore((state) => state.addSample)
  const markRechecked = useSampleStore((state) => state.markRechecked)
  const markArchived = useSampleStore((state) => state.markArchived)
  const runs = useRunStore((state) => state.sheetRuns)
  const runError = useRunStore((state) => state.error)
  const loadRuns = useRunStore((state) => state.loadRuns)
  const moulds = useMouldStore((state) => state.moulds)
  const mouldError = useMouldStore((state) => state.error)
  const loadMoulds = useMouldStore((state) => state.loadMoulds)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PaperSampleInput>(emptySampleForm)
  const [evennessFilter, setEvennessFilter] = useState<EvennessLevel | '全部'>('全部')
  const [stripeFloor, setStripeFloor] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [recheckTarget, setRecheckTarget] = useState<PaperSample | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<PaperSample | null>(null)
  const { mmToCm, formatGrammage } = useUnitConvert()

  useEffect(() => {
    void loadSamples()
    void loadRuns()
    void loadMoulds()
  }, [loadMoulds, loadRuns, loadSamples])

  const runById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs])
  const mouldById = useMemo(() => new Map(moulds.map((mould) => [mould.id, mould])), [moulds])
  const filteredSamples = useMemo(
    () => samples.filter((sample) => (evennessFilter === '全部' || sample.evenness === evennessFilter) && sample.stripeCount >= stripeFloor),
    [evennessFilter, samples, stripeFloor],
  )
  const denseCount = samples.filter((sample) => sample.stripeCount >= 50).length
  const recheckCount = samples.filter((sample) => !sample.rechecked).length
  const archivedCount = samples.filter((sample) => sample.archived).length

  const updateForm = <K extends keyof PaperSampleInput,>(key: K, value: PaperSampleInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.sampleNo.trim() || form.sizeMm <= 0 || form.stripeCount <= 0) return
    setSubmitting(true)
    const run = runById.get(form.runId)
    const created = await addSample({ ...form, sampleNo: form.sampleNo.trim(), archiveBin: '待复检区' }, run)
    setSubmitting(false)
    if (created) {
      setForm(emptySampleForm)
      setShowForm(false)
    }
  }

  const errorMessage = error ?? runError ?? mouldError

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Typography component="h1" variant="h3" color="#344a34">成纸样本与透光检验卡</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>按匀度与帘纹条数分档；返修单标出的样本须复检，复检通过后才能归档。</Typography>
        </Box>
        <Button variant="contained" size="large" onClick={() => setShowForm((current) => !current)} data-testid="new-sample">
          {showForm ? '收起登记' : '新建样本'}
        </Button>
      </Box>

      {errorMessage && <Alert severity="warning">{errorMessage}</Alert>}

      {showForm && (
        <Card data-testid="form-sample" sx={{ borderColor: '#9eb096' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" sx={{ mb: 1 }}>登记成纸样本</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>新样本锁定对应工序的规格版本，默认“待复检”，复检通过后方可归档（先存“待复检区”）。</Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}><TextField fullWidth label="样本编号" value={form.sampleNo} onChange={(event) => updateForm('sampleNo', event.target.value)} inputProps={{ 'data-testid': 'field-sampleNo' }} /></Grid>
              <Grid item xs={12} md={4}>
                <TextField select fullWidth label="对应工序" value={form.runId} onChange={(event) => updateForm('runId', Number(event.target.value))} SelectProps={{ native: true, inputProps: { 'data-testid': 'field-runId' } }}>
                  {!runs.some((run) => run.id === form.runId) && <option value={form.runId}>工序数据载入中</option>}
                  {runs.map((run) => <option key={run.id} value={run.id}>{run.runNo} · {run.runDate} · v{run.specRev ?? 1}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}><TextField fullWidth type="number" label="样本尺寸" value={form.sizeMm} onChange={(event) => updateForm('sizeMm', Number(event.target.value))} inputProps={{ min: 20, max: 1000, step: 1, 'data-testid': 'field-sizeMm' }} InputProps={{ endAdornment: 'mm' }} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth type="number" label="帘纹条数" value={form.stripeCount} onChange={(event) => updateForm('stripeCount', Number(event.target.value))} inputProps={{ min: 1, max: 300, step: 1, 'data-testid': 'field-stripeCount' }} /></Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  select
                  fullWidth
                  label="匀度"
                  value={form.evenness}
                  onChange={(event) => updateForm('evenness', event.target.value as EvennessLevel)}
                  SelectProps={{ native: true, inputProps: { 'data-testid': 'field-evenness' } }}
                >
                  {EVENNESS_LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
                </TextField>
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
              <Button onClick={() => setShowForm(false)}>取消</Button>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting} data-testid="submit-sample">保存样本</Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <StatBadge label="样本总数" value={samples.length} detail="档案柜入库数量" />
        <StatBadge label="已归档" value={archivedCount} detail="复检通过并入库" tone="bamboo" />
        <StatBadge label="待复检" value={recheckCount} detail="含返修单标出，复检后才能归档" tone={recheckCount ? 'warning' : 'neutral'} />
        <StatBadge label="密纹样本" value={denseCount} detail="帘纹条数不少于 50" tone="bamboo" />
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5} md={3}>
              <TextField select fullWidth size="small" label="匀度筛选" value={evennessFilter} onChange={(event) => setEvennessFilter(event.target.value as EvennessLevel | '全部')} SelectProps={{ native: true }}>
                <option value="全部">全部匀度</option>
                {EVENNESS_LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={7} md={4}>
              <RulerInput label="最低帘纹条数" value={stripeFloor} onChange={setStripeFloor} unit="条" min={0} max={300} step={1} compact />
            </Grid>
            <Grid item xs={6} md={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant="body2" color="text.secondary">当前记录</Typography><Typography variant="h5" data-testid="count-sample">{filteredSamples.length}</Typography></Box>
            </Grid>
            <Grid item xs={6} md={3}><Button fullWidth variant="outlined" onClick={() => { setEvennessFilter('全部'); setStripeFloor(0) }}>重置分档</Button></Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {filteredSamples.map((sample) => {
          const run = runById.get(sample.runId)
          const mould = run ? mouldById.get(run.mouldId) : undefined
          const tier = stripeTier(sample.stripeCount)
          const gap = run?.specStripeGap ?? mould?.stripeGap ?? 1
          const flagged = Boolean(sample.flaggedByRepairOrderNo)
          return (
            <Card
              key={sample.id ?? sample.sampleNo}
              data-testid="row-sample"
              sx={{
                border: flagged ? '1.5px solid #e0a13c' : undefined,
                bgcolor: sample.rechecked ? '#fffdf7' : '#fff4d6',
              }}
            >
              <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{sample.sampleNo}</Typography>
                    <Typography variant="caption" color="text.secondary">工序 {run?.runNo ?? '待关联'} · {run?.runDate ?? '日期待补'}</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip size="small" variant="outlined" label={`锁定 ${sample.specRev ? `v${sample.specRev}` : '待关联版本'}`} data-testid={`sample-spec-${sample.id}`} />
                    </Box>
                  </Box>
                  <Chip size="small" color={tier.color} label={tier.label} />
                </Box>

                {!sample.rechecked && (
                  <Alert severity="warning" sx={{ mb: 1.5, py: 0 }} data-testid={`sample-unrechecked-${sample.id}`}>
                    {flagged ? `返修单 ${sample.flaggedByRepairOrderNo} 标出：` : ''}未复检，归档前须按锁定版本（{sample.specRev ? `v${sample.specRev}` : '待关联'}）复检
                  </Alert>
                )}

                <GrainStripePreview
                  gap={gap}
                  wireDiameter={mould?.wireDiameter ?? 0.25}
                  density={run?.specMeshDensity ?? mould?.meshDensity}
                  stripeCount={sample.stripeCount}
                  direction={run?.stripeDirection === '横帘纹' ? 'horizontal' : 'vertical'}
                />
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">帘纹条数</Typography><Typography sx={{ fontWeight: 700 }}>{sample.stripeCount} 条</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">匀度</Typography><Typography sx={{ fontWeight: 700, color: sample.evenness === '均匀' ? 'success.dark' : 'warning.dark' }}>{sample.evenness}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">样本尺寸</Typography><Typography>{sample.sizeMm} mm · {mmToCm(sample.sizeMm)} cm</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">纸页克重</Typography><Typography>{run ? formatGrammage(run.grammage) : '待补'}</Typography></Grid>
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', mt: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    color={sample.archived ? 'success' : 'default'}
                    variant={sample.archived ? 'filled' : 'outlined'}
                    label={sample.archived ? `已归档 ${sample.archiveBin}` : `未归档 · ${sample.archiveBin}`}
                  />
                  {run && isGapOutOfTolerance(run.deviation) && <Chip size="small" color="warning" label={`偏差 ${run.deviation > 0 ? '+' : ''}${run.deviation.toFixed(2)} mm`} />}
                </Box>
                {sample.recheckNote && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>{sample.recheckNote}</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    variant={sample.rechecked ? 'outlined' : 'contained'}
                    color={sample.rechecked ? 'inherit' : 'warning'}
                    disabled={sample.id === undefined}
                    onClick={() => setRecheckTarget(sample)}
                    data-testid={`recheck-${sample.id}`}
                  >
                    {sample.rechecked ? '查看复检' : '复检通过'}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={sample.id === undefined || !sample.rechecked || sample.archived}
                    onClick={() => setArchiveTarget(sample)}
                    data-testid={`archive-${sample.id}`}
                  >
                    {sample.archived ? '已归档' : '归档'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )
        })}
        {filteredSamples.length === 0 && (
          <Card sx={{ gridColumn: '1 / -1' }}><CardContent sx={{ textAlign: 'center', py: 7 }}><Typography color="text.secondary">没有符合当前匀度与帘纹条数分档的样本</Typography></CardContent></Card>
        )}
      </Box>

      <RecheckDialog
        sample={recheckTarget}
        onClose={() => setRecheckTarget(null)}
        onConfirm={async (note) => {
          if (recheckTarget?.id !== undefined) await markRechecked(recheckTarget.id, note)
          setRecheckTarget(null)
        }}
      />
      <ArchiveDialog
        sample={archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async (bin) => {
          if (archiveTarget?.id !== undefined) await markArchived(archiveTarget.id, bin)
          setArchiveTarget(null)
        }}
      />
    </Stack>
  )
}

interface SampleDialogProps {
  sample: PaperSample | null
  onClose: () => void
  onConfirm: (value: string) => Promise<void> | void
}

function RecheckDialog({ sample, onClose, onConfirm }: SampleDialogProps) {
  const [note, setNote] = useState('')
  useEffect(() => {
    setNote(sample?.recheckNote ?? '')
  }, [sample])
  if (!sample) return null
  return (
    <Dialog open={Boolean(sample)} onClose={onClose} maxWidth="xs" fullWidth data-testid="recheck-dialog">
      <DialogTitle>复检 · {sample.sampleNo}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          按锁定 {sample.specRev ? `规格 v${sample.specRev}` : '对应工序规格'} 复核帘纹条数、匀度与偏差。复检通过后解除待复检标记，随后才可归档。
        </Typography>
        <TextField fullWidth multiline minRows={2} label="复检记录" value={note} onChange={(event) => setNote(event.target.value)} inputProps={{ 'data-testid': 'recheck-note' }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" color="warning" onClick={() => onConfirm(note)} data-testid="confirm-recheck">确认复检通过</Button>
      </DialogActions>
    </Dialog>
  )
}

function ArchiveDialog({ sample, onClose, onConfirm }: SampleDialogProps) {
  const [bin, setBin] = useState('')
  useEffect(() => {
    setBin(sample && sample.archived ? sample.archiveBin : '甲柜-01')
  }, [sample])
  if (!sample) return null
  return (
    <Dialog open={Boolean(sample)} onClose={onClose} maxWidth="xs" fullWidth data-testid="archive-dialog">
      <DialogTitle>归档 · {sample.sampleNo}</DialogTitle>
      <DialogContent>
        {!sample.rechecked ? (
          <Alert severity="error" sx={{ mb: 1 }}>样本尚未复检，不能归档。</Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>复检已通过，请填写归档柜位。</Typography>
        )}
        <TextField fullWidth label="归档柜位" value={bin} onChange={(event) => setBin(event.target.value)} inputProps={{ 'data-testid': 'archive-bin' }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={!sample.rechecked || !bin.trim()} onClick={() => onConfirm(bin.trim())} data-testid="confirm-archive">确认归档</Button>
      </DialogActions>
    </Dialog>
  )
}
