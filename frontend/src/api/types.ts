export interface TeamsResponse {
  teams: string[]
  flags: Record<string, string>
  groups: Record<string, string[]>
  hosts: string[]
  data_through: string
  model_trained_through?: string | null
  model_last_trained?: string | null
}

export interface FeedSourceStatus {
  ok: boolean
  error: string | null
  rate_limited: boolean
  last_checked: string
  last_success: string | null
}

export interface StatusResponse {
  football_data_key: boolean
  apifootball_key: boolean
  sources: Record<string, FeedSourceStatus>
  data_through: string | null
  model: {
    trained_through: string | null
    last_trained: string | null
  }
  scheduler: {
    enabled: boolean
    last_check: string | null
    last_trained_at: string | null
    retraining_now: boolean
    last_error: string | null
  } | null
}

export interface OddsSnapshot {
  ts: string
  date: string
  n_sims: number
  locked_count: number
  odds: Record<string, number>
}

export interface OddsHistoryResponse {
  snapshots: OddsSnapshot[]
}

export interface SquadMetrics {
  squad_value_m: number | null
  fifa_rank: number | null
  league_idx: number | null
  avg_caps: number | null
  coach_wr: number | null
}

export interface H2HMatch {
  date: string
  home: string
  away: string
  score_home: number
  score_away: number
  tournament: string
}

export interface H2HData {
  total: number
  team1_wins: number
  draws: number
  team2_wins: number
  last5: H2HMatch[]
}

export interface PredictResponse {
  home: string
  away: string
  neutral: boolean
  p_home: number
  p_draw: number
  p_away: number
  lambda_home: number
  lambda_away: number
  elo_home: number
  elo_away: number
  score_matrix: number[][]
  top_scores: [number, number, number][]
  squad: { home: SquadMetrics; away: SquadMetrics }
  h2h: H2HData
}

export interface ManualResult {
  team1: string
  team2: string
  score1: number
  score2: number
}

export interface KoPick {
  team1: string
  team2: string
  winner: string
}

export interface SimulateRequest {
  n_sims: number
  lock_real_results: boolean
  manual_results: ManualResult[]
  squad_strength: number
  ko_picks?: KoPick[]
}

export interface LiveBracketMatch {
  match: number
  stage: 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  team1: string
  team2: string
  slot1: string
  slot2: string
  winner: string | null
  actual: boolean
  pickable: boolean
}

export interface LiveBracketResponse {
  matches: LiveBracketMatch[]
}

export interface SummaryRow {
  team: string
  'P(R32)': number
  'P(R16)': number
  'P(QF)': number
  'P(SF)': number
  'P(Final)': number
  'P(Champion)': number
}

export interface BracketMatch {
  match: number
  stage: string
  team1: string
  team2: string
  winner: string | null
  win_prob: number | null
  actual?: boolean
}

export interface AccuracyMatch {
  match: string
  score: string
  predicted: string
  actual: string
  correct: boolean
  p_home: number
  p_draw: number
  p_away: number
}

export interface SimulateResponse {
  n_sims: number
  locked_count: number
  summary: SummaryRow[]
  rank_probs: Record<string, Record<string, Record<string, number>>>
  bracket: Record<string, BracketMatch>
  accuracy: {
    correct: number
    total: number
    accuracy: number
    brier: number
    matches: AccuracyMatch[]
  }
}

export interface LiveProbs {
  p_home: number
  p_draw: number
  p_away: number
  lambda_home?: number
  lambda_away?: number
}

export interface MatchTeamStats {
  possession: number | null
  shots_on_target: number | null
  total_shots: number | null
  passes: number | null
  passes_accurate: number | null
  corners: number | null
  fouls: number | null
  yellow_cards: number | null
  red_cards: number | null
  saves: number | null
  xg: number | null
}

export interface MatchStats {
  home: MatchTeamStats
  away: MatchTeamStats
}

export interface LiveMatch {
  id: number
  home: string
  away: string
  score_home: number
  score_away: number
  minute: number
  minute_estimated: boolean
  status: string
  utc_date: string
  prematch: LiveProbs | null
  live_probs: LiveProbs | null
  prediction?: LiveProbs
  match_stats: MatchStats | null
}

export interface LiveResponse {
  matches: LiveMatch[]
  todays_upcoming: LiveMatch[]
  error: string | null
  fetched_at: string
}

export interface StandingTeam {
  team: string
  played: number
  pts: number
  gd: number
  gf: number
  wins: number
  status: 'through' | 'contention' | 'eliminated'
  message: string
  next_opponents: string[]
  can_reach_2nd: boolean
  rank: number
}

export interface GroupStanding {
  teams: StandingTeam[]
  remaining_fixtures: { team1: string; team2: string }[]
}

export interface ThirdPlaceTeam {
  group: string
  team: string
  played: number
  pts: number
  gd: number
  gf: number
  wins: number
  remaining: number
  group_done: boolean
}

export interface GoalStats {
  total_goals: number
  games_played: number
  goals_per_game: number
  top_scorers: [string, number][]
  best_defences: [string, number][]
}

export interface ResultsResponse {
  group_results: { team1: string; team2: string; score1: number; score2: number; group: string }[]
  ko_results: { team1: string; team2: string; winner: string }[]
  standings: Record<string, GroupStanding>
  third_place_race: ThirdPlaceTeam[]
  goal_stats: GoalStats
  fetched_at: string
}

export interface ScheduleMatch {
  id: number
  home: string
  away: string
  utc_date: string
  status: string
  minute: number
  stage?: string
  matchday?: number | null
  group?: string
  prediction?: LiveProbs | null
}

export interface TiebreakerRow {
  team: string
  rank: number
  pts: number
  gd: number
  gf: number
  wins: number
  played: number
}

export interface TiebreakerFixture {
  team1: string
  team2: string
  scenarios: {
    home_win: TiebreakerRow[]
    draw: TiebreakerRow[]
    away_win: TiebreakerRow[]
  }
}

export interface TiebreakerGroup {
  current_standings: TiebreakerRow[]
  fixtures: TiebreakerFixture[]
  games_played: number
  games_remaining: number
  tied_pairs: string[][]
}

export interface TiebreakerResponse {
  groups: Record<string, TiebreakerGroup>
  active_groups: Record<string, TiebreakerGroup>
  all_done: boolean
}

export interface CalibrationBin {
  predicted: number[]
  actual: number[]
  counts: number[]
}

export interface CalibrationResponse {
  n_matches: number
  calibration: Record<string, CalibrationBin>
  brier: Record<string, number>
  confidence_distribution: {
    bin_centers: number[]
    counts: number[]
  }
}

export interface WhatIfRequest {
  hypothetical: { team1: string; team2: string; score1: number; score2: number }[]
}

export interface R32Projection {
  match: number
  team1: string | null
  note1: string
  team2: string | null
  note2: string
}

export interface WhatIfResponse {
  standings: Record<string, GroupStanding>
  third_place_race: ThirdPlaceTeam[]
  r32_projections: R32Projection[]
}

export interface TeamResponse {
  team: string
  group: string
  flag_code: string | null
  elo: number | null
  group_standing: StandingTeam[]
  wc2026_results: { opponent: string; goals_for: number; goals_against: number; result: string }[]
  championship_odds: Record<string, number> | null
  bracket_path: { stage: string; match: number; opponent: string; win_prob: number | null; winner: string }[] | null
  next_match: ScheduleMatch | null
}
