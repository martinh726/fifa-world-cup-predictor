import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dices, Play, Trash2, Trophy, BarChart3, TrendingUp, ListOrdered, Target,
  CircleCheck, CircleX, Ruler,
} from 'lucide-react'
import { fetchSimulate, fetchCalibration, fetchOddsHistory } from '../api'
import type { CalibrationResponse } from '../api/types'
import { useAppStore } from '../store/useAppStore'
import { ChampionshipOddsBar } from '../components/charts/ChampionshipOddsBar'
import { OddsTimelineChart } from '../components/charts/OddsTimelineChart'
import { BracketViewer } from '../components/bracket/BracketViewer'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard, SectionCard } from '../components/ui/GlassCard'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Collapsible } from '../components/ui/Collapsible'
import { EmptyState } from '../components/ui/EmptyState'
import { CardSkeleton } from '../components/ui/Skeleton'
import { cn } from '../utils/cn'
import { baseLayout, CHART_COLORS, CHART_CONFIG } from '../components/charts/plotlyTheme'
import toast from 'react-hot-toast'
import Plot from 'react-plotly.js'

const SIM_OPTIONS = [2000, 5000, 10000, 20000]

export function TournamentSimulator() {
  const [nSims, setNSims] = useState(10000)
  const [lockRealResults, setLockRealResults] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState('A')

  const [showCalibration, setShowCalibration] = useState(false)
  const { data: calibData } = useQuery({
    queryKey: ['calibration'],
    queryFn: fetchCalibration,
    staleTime: 300_000,
    enabled: showCalibration,
  })

  const { manualResults, squadStrength, lastSimResult, oddsHistory,
    setLastSimResult, appendOddsHistory, clearOddsHistory, clearManualResults } = useAppStore()
  const queryClient = useQueryClient()

  const { data: oddsHistoryData, isError: oddsHistoryError } = useQuery({
    queryKey: ['odds-history'],
    queryFn: fetchOddsHistory,
    staleTime: 300_000,
  })

  const { mutate: runSim, isPending } = useMutation({
    mutationFn: fetchSimulate,
    onSuccess: (data) => {
      setLastSimResult(data)
      const odds: Record<string, number> = {}
      data.summary.forEach(r => { odds[r.team] = r['P(Champion)'] })
      appendOddsHistory(oddsHistory.length + 1, data.locked_count, odds)
      // Invalidate bracket SVG cache
      queryClient.invalidateQueries({ queryKey: ['bracket-svg', 'simulated'] })
      toast.success(`Simulation complete: ${data.n_sims.toLocaleString()} runs`)
    },
    onError: () => toast.error('Simulation failed'),
  })

  const handleRun = () => {
    runSim({ n_sims: nSims, lock_real_results: lockRealResults, manual_results: manualResults, squad_strength: squadStrength })
  }

  const groups = lastSimResult ? Object.keys(lastSimResult.rank_probs).sort() : []

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Tournament Simulator"
        icon={Dices}
        subtitle="Monte-Carlo the whole tournament — group tables, knockout paths, and championship odds."
      />

      {/* Command bar */}
      <GlassCard className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-4 items-end">
          <div>
            <label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 block mb-2">
              Simulations
            </label>
            <div className="flex rounded-xl overflow-hidden border border-[var(--glass-border)]">
              {SIM_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setNSims(n)}
                  className={cn(
                    'px-3.5 py-2 min-h-10 text-[13px] font-semibold transition-colors cursor-pointer',
                    nSims === n
                      ? 'bg-host-blue-bright text-white'
                      : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.09] hover:text-ink-50',
                  )}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-200 cursor-pointer min-h-10">
            <input
              type="checkbox"
              checked={lockRealResults}
              onChange={e => setLockRealResults(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
              style={{ accentColor: 'var(--color-gold)' }}
            />
            Lock in real results
          </label>

          <Button variant="primary" icon={Play} loading={isPending} onClick={handleRun}>
            {isPending ? 'Simulating…' : 'Run simulation'}
          </Button>

          {lastSimResult && (
            <Button
              variant="secondary"
              icon={Trash2}
              disabled={isPending}
              onClick={() => { clearManualResults(); handleRun() }}
            >
              Clear manual & re-run
            </Button>
          )}
        </div>

        {manualResults.length > 0 && (
          <div className="text-xs text-ink-400">
            {manualResults.length} manual result(s) active:
            {manualResults.map(r => ` ${r.team1} ${r.score1}–${r.score2} ${r.team2}`).join(' ·')}
          </div>
        )}
      </GlassCard>

      {!lastSimResult && !isPending && (
        <EmptyState
          icon={Dices}
          title="No simulation yet"
          hint="Press Run simulation to estimate every team's chances across thousands of tournaments."
        />
      )}

      {lastSimResult && (
        <>
          {/* Championship odds */}
          <SectionCard
            icon={Trophy}
            accent="gold"
            title={`Championship odds — ${lastSimResult.n_sims.toLocaleString()} sims · ${lastSimResult.locked_count} locked`}
          >
            <ChampionshipOddsBar summary={lastSimResult.summary} />
          </SectionCard>

          {/* Full odds table */}
          <SectionCard icon={BarChart3} accent="green" title="Probability of reaching each stage">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-400 border-b border-white/[0.08] text-[11px] uppercase tracking-wider">
                    <th className="text-left py-2 pr-3 font-semibold">Team</th>
                    {['P(R32)', 'P(R16)', 'P(QF)', 'P(SF)', 'P(Final)', 'P(Champion)'].map(c => (
                      <th key={c} className="text-right py-2 px-2 font-semibold">{c.replace('P(', '').replace(')', '')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lastSimResult.summary.map(row => (
                    <tr key={row.team} className="border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                      <td className="py-1.5 pr-3 text-ink-50">{row.team}</td>
                      {['P(R32)', 'P(R16)', 'P(QF)', 'P(SF)', 'P(Final)', 'P(Champion)'].map(c => {
                        const v = (row as any)[c] as number
                        return (
                          <td
                            key={c}
                            className="text-right px-2 py-1.5 font-mono text-xs text-ink-50 rounded"
                            style={{ backgroundColor: `rgba(60,172,59,${(v * 0.45 + 0.03).toFixed(2)})` }}
                          >
                            {(v * 100).toFixed(1)}%
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Championship odds trend */}
          {oddsHistory.length >= 2 && (
            <SectionCard
              icon={TrendingUp}
              accent="blue"
              title="Championship odds trend across runs"
              actions={
                <Button variant="ghost" size="sm" icon={Trash2} onClick={clearOddsHistory}>
                  Clear
                </Button>
              }
            >
              <OddsTrendChart oddsHistory={oddsHistory} summary={lastSimResult.summary} />
            </SectionCard>
          )}

          {/* Championship odds over the tournament (server-persisted daily snapshots) */}
          {!oddsHistoryError && (oddsHistoryData?.snapshots.length ?? 0) >= 2 && (
            <SectionCard
              icon={TrendingUp}
              accent="green"
              title="Championship odds over the tournament"
            >
              <OddsTimelineChart snapshots={oddsHistoryData!.snapshots} />
            </SectionCard>
          )}

          {/* Group finishing positions */}
          <SectionCard icon={ListOrdered} accent="blue" title="Group finishing positions">
            <div className="relative inline-block mb-3">
              <select
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
                className="bg-white/[0.05] border border-[var(--glass-border)] rounded-xl px-3.5 py-2 min-h-10 pr-8 text-sm text-ink-50 transition-colors focus:outline-none focus:border-gold/60 appearance-none cursor-pointer"
              >
                {groups.map(g => <option key={g} value={g} className="bg-ink-900">Group {g}</option>)}
              </select>
            </div>
            {lastSimResult.rank_probs[selectedGroup] && (
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-ink-400 border-b border-white/[0.08] text-[11px] uppercase tracking-wider">
                    <th className="text-left py-1.5 font-semibold">Team</th>
                    {['P(1st)', 'P(2nd)', 'P(3rd)', 'P(4th)'].map(c => (
                      <th key={c} className="text-right py-1.5 px-2 font-semibold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(lastSimResult.rank_probs[selectedGroup]).map(([team, probs]) => (
                    <tr key={team} className="border-b border-white/[0.05]">
                      <td className="py-1.5 text-ink-50">{team}</td>
                      {['P(1st)', 'P(2nd)', 'P(3rd)', 'P(4th)'].map(c => (
                        <td key={c} className="text-right px-2 py-1.5 text-xs font-mono text-ink-200">
                          {((probs[c] ?? 0) * 100).toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          {/* Bracket */}
          <SectionCard icon={Trophy} accent="gold" title="Simulated bracket">
            <BracketViewer type="simulated" />
          </SectionCard>

          {/* Accuracy */}
          {lastSimResult.accuracy.total > 0 && (
            <SectionCard icon={Target} accent="red" title="Prediction accuracy on completed matches">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <StatCard
                  label="Correct outcomes"
                  value={`${lastSimResult.accuracy.correct} / ${lastSimResult.accuracy.total}`}
                  accent="neutral"
                />
                <StatCard
                  label="Accuracy"
                  value={`${(lastSimResult.accuracy.accuracy * 100).toFixed(0)}%`}
                  accent="green"
                />
                <StatCard
                  label="Brier score"
                  value={lastSimResult.accuracy.brier.toFixed(3)}
                  sub="lower = better"
                  accent="gold"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-400 border-b border-white/[0.08] text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1.5 font-semibold">Match</th>
                      <th className="py-1.5 font-semibold">Score</th>
                      <th className="py-1.5 font-semibold">Pred</th>
                      <th className="py-1.5 font-semibold">Act</th>
                      <th className="py-1.5 font-semibold">Hit</th>
                      <th className="py-1.5 font-semibold">P(H)</th>
                      <th className="py-1.5 font-semibold">P(D)</th>
                      <th className="py-1.5 font-semibold">P(A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSimResult.accuracy.matches.map((m, i) => (
                      <tr key={i} className="border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                        <td className="py-1.5 text-ink-200">{m.match}</td>
                        <td className="py-1.5 text-center text-ink-400">{m.score}</td>
                        <td className="py-1.5 text-center text-ink-200">{m.predicted}</td>
                        <td className="py-1.5 text-center text-ink-200">{m.actual}</td>
                        <td className="py-1.5">
                          <span className="grid place-items-center">
                            {m.correct
                              ? <CircleCheck size={14} className="text-host-green" />
                              : <CircleX size={14} className="text-host-red" />}
                          </span>
                        </td>
                        <td className="py-1.5 text-center font-medium text-host-blue-bright">{(m.p_home * 100).toFixed(0)}%</td>
                        <td className="py-1.5 text-center text-ink-400">{(m.p_draw * 100).toFixed(0)}%</td>
                        <td className="py-1.5 text-center font-medium text-host-red">{(m.p_away * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Model calibration — always visible, loads on demand */}
      <Collapsible title="Model calibration (reliability diagram)" icon={Ruler} accent="gold">
        {!showCalibration && (
          <Button variant="secondary" size="sm" onClick={() => setShowCalibration(true)}>
            Compute calibration
          </Button>
        )}
        {showCalibration && calibData && calibData.n_matches > 0 && (
          <CalibrationSection data={calibData} />
        )}
        {showCalibration && calibData && calibData.n_matches === 0 && (
          <p className="text-ink-400 text-sm">No completed matches to compute calibration from.</p>
        )}
        {showCalibration && !calibData && <CardSkeleton lines={3} />}
      </Collapsible>
    </div>
  )
}

function CalibrationSection({ data }: { data: CalibrationResponse }) {
  const COLORS: Record<string, string> = {
    'Home Win': CHART_COLORS.home,
    'Draw': CHART_COLORS.draw,
    'Away Win': CHART_COLORS.away,
  }

  const calibTraces = Object.entries(data.calibration).map(([label, bins]) => ({
    type: 'scatter' as const,
    mode: 'lines+markers' as const,
    name: label,
    x: bins.predicted,
    y: bins.actual,
    marker: { color: COLORS[label] ?? CHART_COLORS.textMuted, size: 7 },
    line: { color: COLORS[label] ?? CHART_COLORS.textMuted, width: 2 },
    hovertemplate: `<b>${label}</b><br>Predicted: %{x:.1%}<br>Actual: %{y:.1%}<br>n=%{text}<extra></extra>`,
    text: bins.counts.map(String),
  }))

  const diagTrace = {
    type: 'scatter' as const,
    mode: 'lines' as const,
    name: 'Perfect calibration',
    x: [0, 1],
    y: [0, 1],
    line: { color: CHART_COLORS.gold, width: 1.5, dash: 'dash' as const },
    hoverinfo: 'skip' as const,
  }

  const confTrace = {
    type: 'bar' as const,
    name: 'Match count',
    x: data.confidence_distribution.bin_centers,
    y: data.confidence_distribution.counts,
    marker: { color: 'rgba(61,82,196,0.20)', line: { color: 'rgba(61,82,196,0.5)', width: 1 } },
    hovertemplate: 'Confidence: %{x:.0%}<br>Matches: %{y}<extra></extra>',
    yaxis: 'y2',
    showlegend: false,
  }

  return (
    <div className="mt-2 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {Object.entries(data.brier).map(([label, score]) => (
          <StatCard
            key={label}
            label={`${label} Brier`}
            value={score.toFixed(3)}
            sub="lower = better"
            valueColor={COLORS[label] ?? 'var(--color-ink-50)'}
          />
        ))}
      </div>

      <Plot
        data={[diagTrace, ...calibTraces, confTrace as any]}
        layout={baseLayout({
          height: 320,
          margin: { l: 50, r: 50, t: 20, b: 50 },
          xaxis: {
            title: { text: 'Predicted probability', font: { size: 11 } },
            range: [0, 1],
            tickformat: '.0%',
            color: CHART_COLORS.textMuted,
            gridcolor: CHART_COLORS.grid,
          },
          yaxis: {
            title: { text: 'Actual frequency', font: { size: 11 } },
            range: [0, 1],
            tickformat: '.0%',
            color: CHART_COLORS.textMuted,
            gridcolor: CHART_COLORS.grid,
          },
          yaxis2: {
            overlaying: 'y',
            side: 'right',
            title: { text: 'Match count', font: { size: 10 } },
            color: CHART_COLORS.textMuted,
            showgrid: false,
          },
          legend: { orientation: 'h', y: -0.22, font: { size: 10 } },
          hovermode: 'closest',
        })}
        config={CHART_CONFIG}
        style={{ width: '100%' }}
      />
      <p className="text-[10px] text-ink-400">
        Based on {data.n_matches} completed group-stage matches. Points above the dashed line = model
        under-confident; below = over-confident. Bars show how often the model assigns each confidence level.
      </p>
    </div>
  )
}

function OddsTrendChart({
  oddsHistory, summary,
}: {
  oddsHistory: { run: number; locked: number; odds: Record<string, number> }[]
  summary: { team: string }[]
}) {
  const topTeams = summary.slice(0, 8).map(r => r.team)
  const colors = [...CHART_COLORS.categorical, '#E9A13B', '#5B6FD6', '#E9CE7A']
  return (
    <Plot
      data={topTeams.map((team, i) => ({
        type: 'scatter', mode: 'lines+markers',
        name: team,
        x: oddsHistory.map(h => `Run ${h.run}`),
        y: oddsHistory.map(h => h.odds[team] ?? 0),
        line: { color: colors[i % colors.length], width: 2 },
      })) as any[]}
      layout={baseLayout({
        height: 280,
        margin: { l: 40, r: 10, t: 10, b: 40 },
        yaxis: { tickformat: '.1%', color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.grid },
        xaxis: { color: CHART_COLORS.textMuted },
        legend: { orientation: 'h', y: -0.25, font: { size: 10 } },
        hovermode: 'x unified',
      })}
      config={CHART_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
