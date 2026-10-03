import { useEffect, useMemo } from 'react'
import { Alert, Box, Card, CardContent, Chip, Divider, Grid, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { ProcessTimeline, type ProcessStep } from '../components/common/ProcessTimeline'
import { StatBadge } from '../components/common/StatBadge'
import { useMouldFilter } from '../hooks/useMouldFilter'
import { useFiberStore } from '../stores/fiberStore'
import { useMouldStore } from '../stores/mouldStore'
import { useRunStore } from '../stores/runStore'
import { useSampleStore } from '../stores/sampleStore'
import { runSpecLabel } from '../utils/specVersion'
import { isGapOutOfTolerance } from '../utils/stripe'

function startOfCurrentWeek(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const distance = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + distance)
  return date
}

function isInCurrentWeek(value: string): boolean {
  const start = startOfCurrentWeek()
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const date = new Date(`${value}T00:00:00`)
  return date >= start && date < end
}

const processSteps: ProcessStep[] = [
  { label: '纤维蒸煮', detail: '石灰或纯碱处理，按料批记录时长。', status: 'done' },
  { label: '清浆打浆', detail: '校核打浆度，为抄纸提供稳定浆料。', status: 'done' },
  { label: '帘槽抄纸', detail: '依据纸帘密度控制帘纹方向与次数。', status: 'active' },
  { label: '压榨干燥', detail: '火墙或日晒定形，记录克重与叠高。', status: 'pending' },
  { label: '透光复检', detail: '核对匀度、帘纹条数与偏差。', status: 'pending' },
]

export default function Dashboard() {
  const moulds = useMouldStore((state) => state.moulds)
  const mouldError = useMouldStore((state) => state.error)
  const loadMoulds = useMouldStore((state) => state.loadMoulds)
  const batches = useFiberStore((state) => state.fiberBatches)
  const batchError = useFiberStore((state) => state.error)
  const loadBatches = useFiberStore((state) => state.loadFiberBatches)
  const runs = useRunStore((state) => state.sheetRuns)
  const runError = useRunStore((state) => state.error)
  const loadRuns = useRunStore((state) => state.loadRuns)
  const samples = useSampleStore((state) => state.paperSamples)
  const sampleError = useSampleStore((state) => state.error)
  const loadSamples = useSampleStore((state) => state.loadSamples)

  useEffect(() => {
    void loadMoulds()
    void loadBatches()
    void loadRuns()
    void loadSamples()
  }, [loadBatches, loadMoulds, loadRuns, loadSamples])

  const { filteredMoulds: activeMoulds } = useMouldFilter(moulds, '', '在用')
  const currentWeekRuns = useMemo(() => runs.filter((run) => isInCurrentWeek(run.runDate)), [runs])
  const runById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs])
  const mouldByIdForSamples = useMemo(() => new Map(moulds.map((mould) => [mould.id, mould])), [moulds])
  const pendingSamples = useMemo(
    () => samples.filter((sample) => !sample.rechecked),
    [samples],
  )
  const activeRate = moulds.length ? Math.round((activeMoulds.length / moulds.length) * 100) : 0
  const error = mouldError ?? batchError ?? runError ?? sampleError

  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" variant="h3" color="#344a34">
          工作台
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          汇总纸帘状态、料批与本周工序，优先处理超差帘纹和待复检样本。
        </Typography>
      </Box>

      {error && <Alert severity="warning">{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <StatBadge label="在册纸帘" value={moulds.length} detail={`在用 ${activeMoulds.length} 张`} />
        <StatBadge label="纤维料批" value={batches.length} detail="覆盖四类造纸纤维" tone="bamboo" />
        <StatBadge label="本周工序" value={currentWeekRuns.length} detail="按自然周统计" tone="bamboo" />
        <StatBadge label="待复检样本" value={pendingSamples.length} detail="匀度或帘纹偏差需复核" tone={pendingSamples.length ? 'warning' : 'neutral'} />
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2.5 }}>
                <Box>
                  <Typography variant="h5">纸帘配比与使用状态</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    在用率 {activeRate}%，竹丝帘适合常规书写纸，铜丝帘用于细密帘纹。
                  </Typography>
                </Box>
                <Chip label={`${activeMoulds.length}/${moulds.length} 在用`} color="success" variant="outlined" />
              </Box>
              <Stack spacing={2}>
                {['在用', '待修补', '退役'].map((status) => {
                  const count = moulds.filter((mould) => mould.state === status).length
                  const percentage = moulds.length ? (count / moulds.length) * 100 : 0
                  return (
                    <Box key={status}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 650 }}>{status}</Typography>
                        <Typography variant="body2" color="text.secondary">{count} 张</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        color={status === '在用' ? 'success' : status === '待修补' ? 'warning' : 'inherit'}
                        sx={{ height: 8, borderRadius: 5, bgcolor: '#e8e1d4' }}
                      />
                    </Box>
                  )
                })}
              </Stack>
              <Divider sx={{ my: 2.5 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {activeMoulds.map((mould) => (
                  <Chip key={mould.id ?? mould.mouldNo} label={`${mould.mouldNo} · ${mould.wireMaterial} · ${mould.meshDensity} 根/cm`} variant="outlined" />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h5" sx={{ mb: 2 }}>标准工序路径</Typography>
              <ProcessTimeline steps={processSteps} compact />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box>
              <Typography variant="h5">待复检样本</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                返修单标出或新登记后尚未复检的样本在此列出；复检通过、归档后自动移出。
              </Typography>
            </Box>
            <Chip label={`${pendingSamples.length} 条提醒`} color={pendingSamples.length ? 'warning' : 'success'} />
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell>样本号</TableCell>
                  <TableCell>对应工序</TableCell>
                  <TableCell>依据版本</TableCell>
                  <TableCell>匀度</TableCell>
                  <TableCell align="right">帘纹条数</TableCell>
                  <TableCell>帘纹偏差</TableCell>
                  <TableCell>状态 / 存档</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingSamples.map((sample) => {
                  const run = runById.get(sample.runId)
                  const deviation = run?.deviation ?? 0
                  return (
                    <TableRow key={sample.id ?? sample.sampleNo} sx={{ bgcolor: '#fff8df' }}>
                      <TableCell sx={{ fontWeight: 700 }}>{sample.sampleNo}</TableCell>
                      <TableCell>{run?.runNo ?? '工序待关联'}</TableCell>
                      <TableCell><Chip size="small" variant="outlined" color="warning" label={sample.specRev ? `规格 v${sample.specRev}` : '版本待关联'} /></TableCell>
                      <TableCell>{sample.evenness}</TableCell>
                      <TableCell align="right">{sample.stripeCount}</TableCell>
                      <TableCell>
                        <Chip size="small" color={isGapOutOfTolerance(deviation) ? 'warning' : 'default'} label={`${deviation > 0 ? '+' : ''}${deviation.toFixed(2)} mm`} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color="warning" label={sample.flaggedByRepairOrderNo ? `返修单 ${sample.flaggedByRepairOrderNo} 标出` : '未复检'} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{sample.archiveBin}</Typography>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {pendingSamples.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>当前没有待复检样本</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box>
              <Typography variant="h5">工序依据的规格版本</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                每条工序锁定登记当时的纸帘规格；返修后旧工序仍按旧版判定，标“返修前旧版”。
              </Typography>
            </Box>
            <Chip label={`${runs.length} 槽工序`} variant="outlined" />
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>工序号</TableCell>
                  <TableCell>纸帘</TableCell>
                  <TableCell>依据版本（锁定标准间距）</TableCell>
                  <TableCell>实测 / 偏差</TableCell>
                  <TableCell>判定</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((run) => {
                  const mould = mouldByIdForSamples.get(run.mouldId)
                  const stale = mould ? (mould.specRev ?? 1) > (run.specRev ?? 1) : false
                  return (
                    <TableRow key={run.id ?? run.runNo} data-testid={`dashboard-run-spec-${run.id}`} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{run.runNo}</TableCell>
                      <TableCell>{mould?.mouldNo ?? '未关联'}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{runSpecLabel(run, mould)}</Typography>
                        {mould?.specSource.kind === 'repair' && (
                          <Typography variant="caption" color="text.secondary">当前版本由返修单 {mould.specSource.repairOrderNo} 应用</Typography>
                        )}
                      </TableCell>
                      <TableCell>{run.measuredGap.toFixed(2)} mm · {run.deviation > 0 ? '+' : ''}{run.deviation.toFixed(2)} mm</TableCell>
                      <TableCell>
                        <Chip size="small" color={isGapOutOfTolerance(run.deviation) ? 'warning' : 'success'} label={isGapOutOfTolerance(run.deviation) ? '超差（按锁定版）' : '合格（按锁定版）'} />
                        {stale && <Chip size="small" sx={{ ml: 0.5 }} color="warning" variant="outlined" label="旧版工序" />}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>暂无工序数据</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  )
}
