import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Sidebar } from './components/shared/Sidebar'
import { MatchPredictor } from './pages/MatchPredictor'
import { TournamentSimulator } from './pages/TournamentSimulator'
import { Live } from './pages/Live'
import { LiveTracker } from './pages/LiveTracker'
import { TeamFocus } from './pages/TeamFocus'
import { ScenarioBuilder } from './pages/ScenarioBuilder'

const NAV = [
  { to: '/', label: '🎯 Predictor', end: true },
  { to: '/simulator', label: '🎲 Simulator' },
  { to: '/live', label: '📡 Live' },
  { to: '/tracker', label: '📊 Tracker' },
  { to: '/team', label: '🏳️ Team Focus' },
  { to: '/scenarios', label: '🔮 Scenarios' },
]

export default function App() {
  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab nav */}
        <nav className="flex gap-1 px-4 pt-3 pb-0 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-400 bg-slate-800'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5">
          <Routes>
            <Route path="/" element={<MatchPredictor />} />
            <Route path="/simulator" element={<TournamentSimulator />} />
            <Route path="/live" element={<Live />} />
            <Route path="/tracker" element={<LiveTracker />} />
            <Route path="/team" element={<TeamFocus />} />
            <Route path="/scenarios" element={<ScenarioBuilder />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
