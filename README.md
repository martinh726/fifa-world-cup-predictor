<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/en/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/250px-2026_FIFA_World_Cup_emblem.svg.png" alt="2026 FIFA World Cup" width="180"/>
</p>

# 2026 FIFA World Cup Predictor

Predicts individual match outcomes (win/draw/loss probabilities + scorelines) and simulates the full 2026 World Cup bracket (48 teams, USA/Canada/Mexico) thousands of times to estimate every team's championship odds — updating live as real tournament results come in.

Full-stack application: **FastAPI** backend exposing the ML/simulation engine as a JSON API, **React + Vite** frontend with real-time polling.

## Quick start

### Backend (terminal 1)

```bash
.venv/Scripts/uvicorn backend.main:app --reload --port 8000
```

### Frontend (terminal 2)

```bash
cd frontend
npm install      # first time only
npm run dev
```

Then open **http://localhost:5173** in your browser.

> **API only**: the backend is also browsable at http://localhost:8000/docs (Swagger UI).

## Features

### Match Predictor

Pick any two teams and get:

- Win / draw / loss probabilities
- Scoreline heatmap and most likely exact scores
- Expected goals (xG) for each side
- Elo ratings
- Squad comparison card: market value, FIFA ranking, top-league player share, average caps, coach win rate
- Injury / suspension overrides that reduce a team's effective squad quality (sidebar)
- Head-to-head history: all-time record with win/draw/loss breakdown and last 5 meetings

### Tournament Simulator

Monte Carlo simulation of the remaining bracket (2,000–20,000 runs):

- Championship odds for all 48 teams
- Per-stage advancement probabilities (Round of 32 through Final)
- Group finishing positions
- Simulated bracket — shows the most likely matchup and winner for every R32–Final match with win probability badges, rendered round-by-round with flag icons; upset lightning badge on matches where the favourite has under 60% chance
- Real results locked in automatically; manual result entry as a fallback
- Championship odds trend chart across simulation runs (tracks how odds shift as results come in)
- Prediction accuracy tracker: correct result %, Brier score, and per-match breakdown

### Live (in-game win probability)

Powered by the [football-data.org](https://www.football-data.org/) free API:

- Auto-fetches live WC matches every 30 seconds
- Displays current score, minute, and real-time win probabilities computed from Poisson remaining-goals math
- Win probability timeline chart that builds up as the match progresses
- Falls back to today's scheduled matches with pre-match predictions when no game is live

### Live Tracker

- All played 2026 WC matches synced from the API every 5 minutes (auto-refresh toggle)
- Current group standings with points, goal difference, goals scored, and qualification status indicators (through / eliminated / in contention) with per-team scenario messages
- Third-place race tracker: current top-8 vs below-cutoff split
- Live bracket — visualizes every knockout match (R32 through Final) from actual results
- Goal stats panel: total goals, goals per game, top scorers, and best defences
- Full schedule view for the next 30 days with pre-match predictions
- Manual result entry for matches not yet in the dataset

### Team Focus

Follow a single team throughout the tournament:

- Hero header with flag, group, and Elo rating
- Group standing table with the focus team highlighted
- All WC 2026 results for the team (colour-coded wins/draws/losses)
- Stage-by-stage advancement odds bar chart (R32 through Champion)
- Predicted bracket path — shows likely opponents and win probabilities at each stage
- Next match card with kick-off time and pre-match win probability

## Setup

### Prerequisites

```bash
# Python dependencies (ML + backend)
pip install -r requirements.txt
pip install -r requirements-api.txt

# Train the model (required before first run)
.venv/Scripts/python.exe -m src.train
```

### Environment variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `FOOTBALL_DATA_API_KEY` | Free key from [football-data.org](https://www.football-data.org/) — enables live scores |
| `APIFOOTBALL_API_KEY` | Optional second source |
| `SQUAD_STRENGTH` | Blend weight for squad quality adjustment (default `0.18`) |

### Frontend dependencies

```bash
cd frontend && npm install
```

## Running

```bash
# Backend (from project root)
.venv/Scripts/uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm run dev
```

## Retraining

Re-run every few days so the models also learn from completed WC matches:

```bash
.venv/Scripts/python.exe -m src.train
```

This refreshes `models/` and updates `reports/backtest.md`.

## How it works

- **Data**: [martj42's international results dataset](https://github.com/martj42/international_results) — every men's full international since 1872 (~49,000 matches).
- **Ratings**: Elo computed over the full history (eloratings.net methodology: importance-weighted K-factor, goal-margin multiplier, home advantage).
- **Features (23 total)**: Elo levels/difference, rolling form (goals + points over last 5/10/25 matches), head-to-head record, match importance, venue neutrality, days of rest, **venue altitude**.
- **Models**: Ensemble of four components — gradient-boosted classifier (calibrated), regularized multinomial logistic, Poisson goal models (scorelines), Elo-only logistic. Blend weights chosen on neutral-venue tournament matches; 2022 World Cup is an untouched holdout (see `reports/backtest.md`).
- **Squad adjustment**: Post-prediction logit adjustment using a composite quality score — squad market value (35%), FIFA ranking (25%), top-5 league player share (20%), average caps (10%), coach win rate (10%). Applied after the model blend; strength is adjustable via sidebar slider.
- **In-game probability**: At minute `m` with score `(g_h, g_a)`, remaining lambdas are scaled by `(90 - m) / 90` and the full Poisson joint PMF is summed over all additional-goal combinations.
- **Symmetry**: Neutral-venue forecasts average both home/away orientations.
- **Simulation**: Vectorized Monte Carlo of the official 2026 format — 12 groups, top 2 + 8 best thirds, FIFA's R32 bracket with constraint-based third-place slot allocation, knockouts with extra time and shootout modeling.

## Project layout

```
backend/
  main.py              FastAPI app, lifespan startup, CORS, static file serving
  deps.py              AppState singleton (predictor, results, last sim result)
  cache.py             TTLCache — live (30s), results (300s), schedule (600s)
  bracket_svg.py       Pure-Python SVG bracket renderer (extracted from app.py)
  utils.py             Standings, qual scenarios, goal stats, accuracy helpers
  routers/
    teams.py           GET /api/teams, POST /api/refresh, GET /api/backtest-report
    predict.py         GET /api/predict (probs, xG, scoreline matrix, H2H, squad)
    simulate.py        POST /api/simulate (async Monte Carlo via run_in_executor)
    bracket.py         GET /api/bracket/svg?type=simulated|live
    live.py            GET /api/live, GET /api/schedule
    results.py         GET /api/results (standings, third-place race, goal stats)
    team.py            GET /api/team/{name} (focus view data)

frontend/src/
  api/                 Typed axios wrappers + TypeScript interfaces for all endpoints
  store/               Zustand store (injuries, manualResults, wpaHistory, oddsHistory)
  hooks/               useLivePolling (30s), useResultsPolling (5min)
  components/
    shared/            FlagImage, TeamSelect, MetricCard, Sidebar
    charts/            ProbabilityBar, ScorelineHeatmap, WinProbTimeline, ChampionshipOddsBar
    bracket/           BracketViewer (renders SVG from backend)
  pages/
    MatchPredictor.tsx  Tab 1 — /
    TournamentSimulator.tsx  Tab 2 — /simulator
    Live.tsx            Tab 3 — /live
    LiveTracker.tsx     Tab 4 — /tracker
    TeamFocus.tsx       Tab 5 — /team

src/                   ML pipeline — unchanged
  data_loader.py       Download + normalize the results dataset
  elo.py               Elo ratings over the full history
  features.py          Feature engineering (23 features including altitude)
  train.py             Model training, calibration, WC backtests
  predict.py           MatchPredictor + ingame_probs()
  external_data.py     Squad quality scores, city altitude loader
  livefeed.py          football-data.org API client
  tournament.py        2026 format rules, standings, bracket logic
  simulate.py          Vectorized Monte Carlo tournament engine

data/wc2026.json           Groups, bracket, team-name aliases
data/squad_data.json       Squad quality data for all 48 WC 2026 teams
data/city_altitude.json    Venue altitude lookup (120+ cities)
app.py                     Original Streamlit app (kept for reference)
```
