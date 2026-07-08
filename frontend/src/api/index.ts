import { api } from './client'
import type {
  CalibrationResponse, LiveBracketResponse, LiveResponse, OddsHistoryResponse,
  PredictResponse, ResultsResponse, ScheduleMatch, SimulateRequest,
  SimulateResponse, StatusResponse, TeamResponse, TeamsResponse,
  TiebreakerResponse, WhatIfRequest, WhatIfResponse,
} from './types'

export const fetchTeams = (): Promise<TeamsResponse> =>
  api.get('/teams').then(r => r.data)

export const fetchPredict = (
  home: string,
  away: string,
  neutral = true,
  squadStrength = 0.18,
  injuries: Record<string, number> = {},
): Promise<PredictResponse> =>
  api.get('/predict', {
    params: { home, away, neutral, squad_strength: squadStrength, injuries: JSON.stringify(injuries) },
  }).then(r => r.data)

export const fetchSimulate = (req: SimulateRequest): Promise<SimulateResponse> =>
  api.post('/simulate', req).then(r => r.data)

export const fetchLive = (): Promise<LiveResponse> =>
  api.get('/live').then(r => r.data)

export const fetchResults = (): Promise<ResultsResponse> =>
  api.get('/results').then(r => r.data)

export const fetchSchedule = (days = 30): Promise<{ matches: ScheduleMatch[] }> =>
  api.get('/schedule', { params: { days } }).then(r => r.data)

export const fetchTeam = (name: string): Promise<TeamResponse> =>
  api.get(`/team/${encodeURIComponent(name)}`).then(r => r.data)

export const fetchBracketSvg = (type: 'simulated' | 'live'): Promise<string> =>
  api.get('/bracket/svg', { params: { type }, responseType: 'text' }).then(r => r.data)

export const fetchBacktestReport = (): Promise<{ content: string | null }> =>
  api.get('/backtest-report').then(r => r.data)

export const triggerRefresh = (): Promise<{ status: string; data_through: string }> =>
  api.post('/refresh').then(r => r.data)

export const fetchWhatIf = (req: WhatIfRequest): Promise<WhatIfResponse> =>
  api.post('/what-if', req).then(r => r.data)

export const fetchTiebreaker = (): Promise<TiebreakerResponse> =>
  api.get('/tiebreaker').then(r => r.data)

export const fetchCalibration = (): Promise<CalibrationResponse> =>
  api.get('/calibration').then(r => r.data)

export const fetchStatus = (): Promise<StatusResponse> =>
  api.get('/status').then(r => r.data)

export const fetchBracketLive = (): Promise<LiveBracketResponse> =>
  api.get('/bracket/live').then(r => r.data)

export const fetchOddsHistory = (): Promise<OddsHistoryResponse> =>
  api.get('/odds-history').then(r => r.data)

export * from './types'
