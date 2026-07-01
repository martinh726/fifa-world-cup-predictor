import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { fetchSimulate, fetchCalibration } from '../api'
import type { CalibrationResponse } from '../api/types'
import { useAppStore } from '../store/useAppStore'
import { ChampionshipOddsBar } from '../components/charts/ChampionshipOddsBar'
import { BracketViewer } from '../components/bracket/BracketViewer'
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
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Simulations</label>
            <div className="flex gap-1">
              {SIM_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setNSims(n)}
                  className={`px-3 py-1.5 rounded text-sm ${nSims === n ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={lockRealResults}
              onChange={e => setLockRealResults(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            Lock in real results
          </label>

          <button
            onClick={handleRun}
            disabled={isPending}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm"
          >
            {isPending ? '⏳ Simulating…' : '▶ Run simulation'}
          </button>

          {lastSimResult && (
            <button
              onClick={() => { clearManualResults(); handleRun() }}
              disabled={isPending}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
            >
              🗑️ Clear manual results & re-run
            </button>
          )}
        </div>

        {manualResults.length > 0 && (
          <div className="text-xs text-slate-400">
            {manualResults.length} manual result(s) active:
            {manualResults.map(r => ` ${r.team1} ${r.score1}–${r.score2} ${r.team2}`).join(' ·')}
          </div>
        )}
      </div>

      {!lastSimResult && !isPending && (
        <div className="text-slate-400 text-sm bg-slate-800 rounded-xl p-6 text-center">
          Press <strong>Run simulation</strong> to estimate every team's chances.
        </div>
      )}

      {lastSimResult && (
        <>
          {/* Championship odds */}
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">
              Championship odds — {lastSimResult.n_sims.toLocaleString()} sims, {lastSimResult.locked_count} results locked
            </h3>
            <ChampionshipOddsBar summary={lastSimResult.summary} />
          </div>

          {/* Full odds table */}
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Probability of reaching each stage</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2 pr-3">Team</th>
                    {['P(R32)', 'P(R16)', 'P(QF)', 'P(SF)', 'P(Final)', 'P(Champion)'].map(c => (
                      <th key={c} className="text-right py-2 px-2 text-xs">{c.replace('P(', '').replace(')', '')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lastSimResult.summary.map(row => (
                    <tr key={row.team} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-1.5 pr-3 text-slate-200">{row.team}</td>
                      {['P(R32)', 'P(R16)', 'P(QF)', 'P(SF)', 'P(Final)', 'P(Champion)'].map(c => (
                        <td
                          key={c}
                          className="text-right px-2 py-1.5 font-mono text-xs"
                          style={{ color: `rgba(22,163,74,${(row as any)[c] * 2 + 0.1})` }}
                        >
                          {((row as any)[c] * 100).toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Championship odds trend */}
          {oddsHistory.length >= 2 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-300">📈 Championship odds trend across runs</h3>
                <button onClick={clearOddsHistory} className="text-xs text-slate-500 hover:text-slate-300">
                  🗑️ Clear
                </button>
              </div>
              <OddsTrendChart oddsHistory={oddsHistory} summary={lastSimResult.summary} />
            </div>
          )}

          {/* Group finishing positions */}
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Group finishing positions</h3>
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-white mb-3"
            >
              {groups.map(g => <option key={g} value={g}>Group {g}</option>)}
            </select>
            {lastSimResult.rank_probs[selectedGroup] && (
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1">Team</th>
                    {['P(1st)', 'P(2nd)', 'P(3rd)', 'P(4th)'].map(c => (
                      <th key={c} className="text-right py-1 px-2 text-xs">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(lastSimResult.rank_probs[selectedGroup]).map(([team, probs]) => (
                    <tr key={team} className="border-b border-slate-700/50">
                      <td className="py-1 text-slate-200">{team}</td>
                      {['P(1st)', 'P(2nd)', 'P(3rd)', 'P(4th)'].map(c => (
                        <td key={c} className="text-right px-2 py-1 text-xs font-mono text-slate-300">
                          {((probs[c] ?? 0) * 100).toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Bracket */}
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">🏟️ Simulated Bracket</h3>
            <BracketViewer type="simulated" />
          </div>

          {/* Accuracy */}
          {lastSimResult.accuracy.total > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">🎯 Prediction accuracy on completed matches</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Correct outcomes</div>
                  <div className="text-xl font-bold text-white">
                    {lastSimResult.accuracy.correct} / {lastSimResult.accuracy.total}
                  </div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Accuracy</div>
                  <div className="text-xl font-bold text-green-400">
                    {(lastSimResult.accuracy.accuracy * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-400">Brier score</div>
                  <div className="text-xl font-bold text-white">
                    {lastSimResult.accuracy.brier.toFixed(3)}
                  </div>
                  <div className="text-xs text-slate-500">lower = better</div>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1">Match</th>
                    <th className="py-1">Score</th>
                    <th className="py-1">Pred</th>
                    <th className="py-1">Act</th>
                    <th className="py-1">✓</th>
                    <th className="py-1">P(H)</th>
                    <th className="py-1">P(D)</th>
                    <th className="py-1">P(A)</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSimResult.accuracy.matches.map((m, i) => (
                    <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                      <td className="py-1 text-slate-300">{m.match}</td>
                      <td className="py-1 text-center text-slate-400">{m.score}</td>
                      <td className="py-1 text-center">{m.predicted}</td>
                      <td className="py-1 text-center">{m.actual}</td>
                      <td className="py-1 text-center">{m.correct ? '✅' : '❌'}</td>
                      <td className="py-1 text-center text-blue-400">{(m.p_home * 100).toFixed(0)}%</td>
                      <td className="py-1 text-center text-slate-400">{(m.p_draw * 100).toFixed(0)}%</td>
                      <td className="py-1 text-center text-red-400">{(m.p_away * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Model calibration — always visible, loads on demand */}
      <div className="bg-slate-800 rounded-xl p-4">
        <button
          onClick={() => setShowCalibration(v => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold text-slate-300"
        >
          <span>📐 Model calibration (reliability diagram)</span>
          <span className="text-slate-500 text-xs">{showCalibration ? '▲ hide' : '▼ show'}</span>
        </button>
        {showCalibration && calibData && calibData.n_matches > 0 && (
          <CalibrationSection data={calibData} />
        )}
        {showCalibration && calibData && calibData.n_matches === 0 && (
          <p className="text-slate-500 text-sm mt-3">No completed matches to compute calibration from.</p>
        )}
      </div>
    </div>
  )
}

function CalibrationSection({ data }: { data: CalibrationResponse }) {
  const COLORS: Record<string, string> = {
    'Home Win': '#003087',
    'Draw': '#94a3b8',
    'Away Win': '#c41230',
  }

  const calibTraces = Object.entries(data.calibration).map(([label, bins]) => ({
    type: 'scatter' as const,
    mode: 'lines+markers' as const,
    name: label,
    x: bins.predicted,
    y: bins.actual,
    marker: { color: COLORS[label] ?? '#5878a8', size: 7 },
    line: { color: COLORS[label] ?? '#5878a8', width: 2 },
    hovertemplate: `<b>${label}</b><br>Predicted: %{x:.1%}<br>Actual: %{y:.1%}<br>n=%{text}<extra></extra>`,
    text: bins.counts.map(String),
  }))

  const diagTrace = {
    type: 'scatter' as const,
    mode: 'lines' as const,
    name: 'Perfect calibration',
    x: [0, 1],
    y: [0, 1],
    line: { color: '#c9a227', width: 1.5, dash: 'dash' as const },
    hoverinfo: 'skip' as const,
  }

  const confTrace = {
    type: 'bar' as const,
    name: 'Match count',
    x: data.confidence_distribution.bin_centers,
    y: data.confidence_distribution.counts,
    marker: { color: 'rgba(91,143,212,0.4)', line: { color: 'rgba(91,143,212,0.8)', width: 1 } },
    hovertemplate: 'Confidence: %{x:.0%}<br>Matches: %{y}<extra></extra>',
    yaxis: 'y2',
    showlegend: false,
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(data.brier).map(([label, score]) => (
          <div key={label} className="bg-slate-700 rounded-lg p-3">
            <div className="text-xs text-slate-400">{label} Brier</div>
            <div className="text-lg font-bold" style={{ color: COLORS[label] ?? '#fff' }}>
              {score.toFixed(3)}
            </div>
            <div className="text-[10px] text-slate-500">lower = better</div>
          </div>
        ))}
      </div>

      <Plot
        data={[diagTrace, ...calibTraces, confTrace as any]}
        layout={{
          height: 320,
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#e2e8f0', size: 11 },
          margin: { l: 50, r: 50, t: 20, b: 50 },
          xaxis: {
            title: { text: 'Predicted probability', font: { size: 11 } },
            range: [0, 1],
            tickformat: '.0%',
            color: '#94a3b8',
            gridcolor: '#1e293b',
          },
          yaxis: {
            title: { text: 'Actual frequency', font: { size: 11 } },
            range: [0, 1],
            tickformat: '.0%',
            color: '#94a3b8',
            gridcolor: '#1e293b',
          },
          yaxis2: {
            overlaying: 'y',
            side: 'right',
            title: { text: 'Match count', font: { size: 10 } },
            color: '#475569',
            showgrid: false,
          },
          legend: { orientation: 'h', y: -0.22, font: { size: 10 } },
          hovermode: 'closest',
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
      />
      <p className="text-[10px] text-slate-500">
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
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
  return (
    <Plot
      data={topTeams.map((team, i) => ({
        type: 'scatter', mode: 'lines+markers',
        name: team,
        x: oddsHistory.map(h => `Run ${h.run}`),
        y: oddsHistory.map(h => h.odds[team] ?? 0),
        line: { color: colors[i % colors.length], width: 2 },
      })) as any[]}
      layout={{
        height: 280,
        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        font: { color: '#e2e8f0', size: 11 },
        margin: { l: 40, r: 10, t: 10, b: 40 },
        yaxis: { tickformat: '.1%', color: '#94a3b8', gridcolor: '#1e293b' },
        xaxis: { color: '#94a3b8' },
        legend: { orientation: 'h', y: -0.25, font: { size: 10 } },
        hovermode: 'x unified',
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
    />
  )
}
