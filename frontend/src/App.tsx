import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { Sidebar } from './components/shared/Sidebar'
import { BrandArcPattern } from './components/shared/BrandArcPattern'
import { MatchPredictor } from './pages/MatchPredictor'
import { TournamentSimulator } from './pages/TournamentSimulator'
import { Live } from './pages/Live'
import { LiveTracker } from './pages/LiveTracker'
import { TeamFocus } from './pages/TeamFocus'
import { ScenarioBuilder } from './pages/ScenarioBuilder'
import { Schedule } from './pages/Schedule'
import { Tiebreaker } from './pages/Tiebreaker'

const NAV = [
  { to: '/', label: '🎯 Predictor', end: true },
  { to: '/simulator', label: '🎲 Simulator' },
  { to: '/live', label: '📡 Live' },
  { to: '/tracker', label: '📊 Tracker' },
  { to: '/team', label: '🏳️ Team Focus' },
  { to: '/scenarios', label: '🔮 Scenarios' },
  { to: '/schedule', label: '📅 Schedule' },
  { to: '/tiebreaker', label: '⚖ Tiebreaker' },
]

export default function App() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab nav */}
        <nav
          className="flex gap-0.5 px-4 pt-3 pb-0 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                  isActive
                    ? 'text-[var(--color-wc-blue)] border-[var(--color-wc-blue)] bg-[var(--color-wc-blue)]/5'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <BrandArcPattern variant="divider" opacity={0.6} className="h-1 w-full flex-shrink-0" />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5">
          <Routes>
            <Route path="/" element={<MatchPredictor />} />
            <Route path="/simulator" element={<TournamentSimulator />} />
            <Route path="/live" element={<Live />} />
            <Route path="/tracker" element={<LiveTracker />} />
            <Route path="/team" element={<TeamFocus />} />
            <Route path="/scenarios" element={<ScenarioBuilder />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/tiebreaker" element={<Tiebreaker />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
