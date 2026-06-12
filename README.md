# 2026 FIFA World Cup Predictor

Predicts individual match outcomes (win/draw/loss probabilities + scorelines) and simulates
the full 2026 World Cup bracket (48 teams, USA/Canada/Mexico) thousands of times to estimate
every team's championship odds — updating live as real tournament results come in.

## Quick start

```powershell
.venv\Scripts\python.exe -m streamlit run app.py
```

The dashboard has three tabs:

1. **Match Predictor** — pick two teams, see win/draw/loss probabilities, a scoreline
   heatmap, expected goals, and Elo ratings.
2. **Tournament Simulator** — Monte Carlo simulation of the remaining tournament with
   real results locked in: championship odds, per-stage advancement probabilities,
   group finishing positions.
3. **Live Tracker** — played 2026 matches, current group standings, manual result entry.

Use **Refresh latest results** in the sidebar to pull the newest match results
(the dataset updates within hours of each match).

## Retraining

The model artifacts in `models/` are trained through the date shown in the sidebar.
Re-run every few days during the tournament so the models also learn from new matches:

```powershell
.venv\Scripts\python.exe -m src.train
```

This re-runs the backtest and refreshes `reports/backtest.md`.

## How it works

- **Data**: [martj42's international results dataset](https://github.com/martj42/international_results)
  — every men's full international since 1872 (~49,000 matches), auto-updated during the WC.
- **Ratings**: Elo computed in-house over the full history (eloratings.net methodology:
  importance-weighted K-factor, goal-margin multiplier, home advantage).
- **Features**: Elo levels/difference, rolling form (goals + points over last 5/10/25 matches),
  head-to-head record, match importance, venue neutrality, days of rest.
- **Models**: an ensemble of four components — gradient-boosted classifier (calibrated),
  regularized multinomial logistic, Poisson goal models (scorelines), and an Elo-only
  logistic. Blend weights chosen on neutral-venue tournament matches after the 2014/2018
  cutoffs, shrunk toward uniform; the 2022 World Cup is an untouched holdout
  (see `reports/backtest.md`).
- **Symmetry**: neutral-venue forecasts average both home/away orientations.
- **Simulation**: vectorized Monte Carlo of the official format — 12 groups, top 2 + 8 best
  thirds, FIFA's R32 bracket with constraint-based third-place slot allocation, knockouts
  with extra time and shootout modeling. Played matches are locked; hosts get home advantage.

### Known simplifications

- Group tiebreakers in the *simulator* use points → GD → GF → random (head-to-head is applied
  exactly in the Live Tracker standings, but is rarely decisive after GD/GF).
- Third-place bracket slots use a valid constraint assignment, which may differ from FIFA's
  exact allocation table in edge cases.
- Hosts are treated as at home in knockout matches regardless of actual venue.
- No player-level data (injuries, squads) — team strength is inferred from results only.

## Project layout

```
src/data_loader.py   download + normalize the results dataset
src/elo.py           Elo ratings over the full history
src/features.py      feature engineering (training + prediction)
src/train.py         model training, calibration, WC backtests
src/predict.py       MatchPredictor (single match / batch forecasts)
src/tournament.py    2026 format rules, standings, bracket logic
src/simulate.py      vectorized Monte Carlo tournament engine
app.py               Streamlit dashboard
data/wc2026.json     groups, bracket structure, team-name aliases
```
