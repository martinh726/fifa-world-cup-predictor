<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/en/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/250px-2026_FIFA_World_Cup_emblem.svg.png" alt="2026 FIFA World Cup" width="180"/>
</p>

# 2026 FIFA World Cup Predictor

Predicts individual match outcomes (win/draw/loss probabilities + scorelines) and simulates the full 2026 World Cup bracket (48 teams, USA/Canada/Mexico) thousands of times to estimate every team's championship odds — updating live as real tournament results come in.

## Quick start

```powershell
.venv\Scripts\python.exe -m streamlit run app.py
```

## Features

### 🎯 Match Predictor

Pick any two teams and get:

- Win / draw / loss probabilities
- Scoreline heatmap and most likely exact scores
- Expected goals (xG) for each side
- Elo ratings
- Squad comparison card: market value, FIFA ranking, top-league player share, average caps, coach win rate
- Injury / suspension overrides that reduce a team's effective squad quality

### 🏆 Tournament Simulator

Monte Carlo simulation of the remaining bracket (2,000–20,000 runs):

- Championship odds for all 48 teams
- Per-stage advancement probabilities (Round of 32 through Final)
- Group finishing positions
- **Simulated bracket** — shows the most likely matchup and winner for every R32–Final match with win probability badges, rendered round-by-round with flag icons
- Real results locked in automatically; manual result entry as a fallback

### 🔴 Live (in-game win probability)

Powered by the [football-data.org](https://www.football-data.org/) free API:

- Auto-fetches live WC matches every 30 seconds (uses `@st.fragment` so only the live panel refreshes — the rest of the page stays stable)
- Displays current score, minute, and real-time win probabilities computed from Poisson remaining-goals math
- Win probability timeline chart that builds up as the match progresses
- Falls back to today's scheduled matches with pre-match predictions when no game is live

### 📡 Live Tracker

- All played 2026 WC matches synced from the API every 5 minutes (no manual refresh needed)
- Current group standings with points, goal difference, and goals scored
- **Live bracket** — visualizes every knockout match (R32 through Final) resolved from actual results; matches already decided show the confirmed winner, upcoming slots display the current group leader with a `*` while the group stage is ongoing
- Manual result entry for matches not yet in the dataset
- Injury / suspension override panel wired into every prediction

## Setup

### Basic (no live scores)

```powershell
pip install -r requirements.txt
python -m src.train        # train the model
streamlit run app.py
```

### With live scores

1. Sign up free at [football-data.org](https://www.football-data.org/)
2. Copy `.streamlit/secrets.toml.example` → `.streamlit/secrets.toml`
3. Paste your API key and restart the app

## Retraining

Re-run every few days so the models also learn from completed WC matches:

```powershell
.venv\Scripts\python.exe -m src.train
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
src/data_loader.py    download + normalize the results dataset
src/elo.py            Elo ratings over the full history
src/features.py       feature engineering (23 features including altitude)
src/train.py          model training, calibration, WC backtests
src/predict.py        MatchPredictor + ingame_probs()
src/external_data.py  squad quality scores, city altitude loader
src/livefeed.py       football-data.org API client (live + finished matches)
src/tournament.py     2026 format rules, standings, bracket logic
src/simulate.py       vectorized Monte Carlo tournament engine
app.py                Streamlit dashboard (4 tabs)
data/wc2026.json      groups, bracket, team-name aliases
data/squad_data.json  squad quality data for all 48 WC 2026 teams
data/city_altitude.json  venue altitude lookup (120+ cities)
```

