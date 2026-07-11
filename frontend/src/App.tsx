import { useState } from 'react'
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import {
  Target, Dices, Radio, BarChart3, Flag, WandSparkles, CalendarDays, Scale, Menu, Trophy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './utils/cn'
import { Sidebar } from './components/shared/Sidebar'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { MatchPredictor } from './pages/MatchPredictor'
import { TournamentSimulator } from './pages/TournamentSimulator'
import { Live } from './pages/Live'
import { LiveTracker } from './pages/LiveTracker'
import { TeamFocus } from './pages/TeamFocus'
import { ScenarioBuilder } from './pages/ScenarioBuilder'
import { Schedule } from './pages/Schedule'
import { Tiebreaker } from './pages/Tiebreaker'
import { FinalFour } from './pages/FinalFour'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; live?: boolean }[] = [
  { to: '/', label: 'Predictor', icon: Target, end: true },
  { to: '/simulator', label: 'Simulator', icon: Dices },
  { to: '/final-four', label: 'Final Four', icon: Trophy },
  { to: '/live', label: 'Live', icon: Radio, live: true },
  { to: '/tracker', label: 'Tracker', icon: BarChart3 },
  { to: '/team', label: 'Team Focus', icon: Flag },
  { to: '/scenarios', label: 'Scenarios', icon: WandSparkles },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/tiebreaker', label: 'Tiebreaker', icon: Scale },
]

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden text-ink-50">
      {/* Desktop sidebar — floating glass rail */}
      <div className="hidden lg:block flex-shrink-0 p-3 pr-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <div className={cn('lg:hidden fixed inset-0 z-50', !drawerOpen && 'pointer-events-none')}>
        <div
          className={cn(
            'absolute inset-0 bg-black/60 transition-opacity duration-300',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        <div
          className={cn(
            'absolute left-0 top-0 bottom-0 w-[288px] p-3 transition-transform duration-300 ease-out',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onClose={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar: hamburger (mobile) + tab nav */}
        <div className="flex items-center gap-1 px-3 sm:px-5 flex-shrink-0 bg-ink-950/60 backdrop-blur-md border-b border-white/[0.06]">
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden min-h-11 min-w-11 grid place-items-center text-ink-300 hover:text-ink-50 transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="lg:hidden font-display text-xl text-gold mr-1 select-none" aria-hidden="true">
            26
          </span>
          <nav className="flex gap-0.5 flex-1 overflow-x-auto scrollbar-none">
            {NAV.map(({ to, label, icon: Icon, end, live }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2 px-3.5 min-h-12 text-[13px] font-display uppercase tracking-[0.12em] whitespace-nowrap transition-colors',
                    isActive ? 'text-ink-50' : 'text-ink-400 hover:text-ink-100 hover:bg-white/[0.04]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} strokeWidth={2.2} />
                    {label}
                    {live && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-host-red"
                        style={{ animation: 'pulse-live 1.6s ease-in-out infinite' }}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        'absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-gold transition-[opacity,transform] duration-300 origin-center',
                        isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50',
                      )}
                      aria-hidden="true"
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Page content — re-keyed per route so the entrance animation replays */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div key={location.pathname} className="max-w-[1400px]">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<MatchPredictor />} />
                <Route path="/simulator" element={<TournamentSimulator />} />
                <Route path="/final-four" element={<FinalFour />} />
                <Route path="/live" element={<Live />} />
                <Route path="/tracker" element={<LiveTracker />} />
                <Route path="/team" element={<TeamFocus />} />
                <Route path="/scenarios" element={<ScenarioBuilder />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/tiebreaker" element={<Tiebreaker />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </main>
      </div>

    </div>
  )
}
