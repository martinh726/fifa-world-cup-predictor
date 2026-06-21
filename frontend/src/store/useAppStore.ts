import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ManualResult, SimulateResponse } from '../api/types'

interface WpaPoint { minute: number; p_home: number; p_draw: number; p_away: number }

interface AppStore {
  injuries: Record<string, number>
  manualResults: ManualResult[]
  squadStrength: number
  lastSimResult: SimulateResponse | null
  oddsHistory: { run: number; locked: number; odds: Record<string, number> }[]
  wpaHistory: Record<string, WpaPoint[]>

  setInjury: (team: string, n: number) => void
  clearInjuries: () => void
  addManualResult: (r: ManualResult) => void
  removeManualResult: (team1: string, team2: string) => void
  clearManualResults: () => void
  setSquadStrength: (v: number) => void
  setLastSimResult: (r: SimulateResponse) => void
  appendOddsHistory: (run: number, locked: number, odds: Record<string, number>) => void
  clearOddsHistory: () => void
  appendWpaPoint: (key: string, point: WpaPoint) => void
  clearStaleWpaKeys: (activeKeys: string[]) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      injuries: {},
      manualResults: [],
      squadStrength: 0.18,
      lastSimResult: null,
      oddsHistory: [],
      wpaHistory: {},

      setInjury: (team, n) =>
        set(s => ({ injuries: { ...s.injuries, [team]: n } })),

      clearInjuries: () => set({ injuries: {} }),

      addManualResult: (r) =>
        set(s => ({ manualResults: [...s.manualResults, r] })),

      removeManualResult: (team1, team2) =>
        set(s => ({
          manualResults: s.manualResults.filter(
            r => !(r.team1 === team1 && r.team2 === team2)
          ),
        })),

      clearManualResults: () => set({ manualResults: [] }),

      setSquadStrength: (v) => set({ squadStrength: v }),

      setLastSimResult: (r) => set({ lastSimResult: r }),

      appendOddsHistory: (run, locked, odds) =>
        set(s => {
          const hist = [...s.oddsHistory, { run, locked, odds }]
          return { oddsHistory: hist.slice(-20) }
        }),

      clearOddsHistory: () => set({ oddsHistory: [] }),

      appendWpaPoint: (key, point) =>
        set(s => {
          const prev = s.wpaHistory[key] ?? []
          return {
            wpaHistory: {
              ...s.wpaHistory,
              [key]: [...prev, point].slice(-200),
            },
          }
        }),

      clearStaleWpaKeys: (activeKeys) =>
        set(s => {
          const next: Record<string, WpaPoint[]> = {}
          for (const k of activeKeys) {
            if (s.wpaHistory[k]) next[k] = s.wpaHistory[k]
          }
          return { wpaHistory: next }
        }),
    }),
    { name: 'wc2026-store' }
  )
)
