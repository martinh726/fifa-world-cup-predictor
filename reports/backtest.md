# World Cup Backtest Report

Walk-forward evaluation: for each World Cup, models are trained only on matches
played *before* that tournament, then scored on its matches.
Blend weights (clf/lin/pois/elo) chosen on post-2014/2018 competitive matches: **(0.325, 0.2, 0.125, 0.35)**.
2022 was not used for weight selection — it is the honest holdout.

Lower log-loss / Brier is better. `elo_baseline` is the bar to beat.

|   wc | model        |   n |   log_loss |   brier |   accuracy |
|-----:|:-------------|----:|-----------:|--------:|-----------:|
| 2014 | elo_baseline |  64 |     0.9095 |  0.5384 |     0.6094 |
| 2014 | blend        |  64 |     0.9192 |  0.5452 |     0.6094 |
| 2014 | classifier   |  64 |     0.9233 |  0.5479 |     0.6094 |
| 2014 | linear       |  64 |     0.9237 |  0.5491 |     0.6094 |
| 2014 | poisson      |  64 |     0.9541 |  0.5694 |     0.6250 |
| 2018 | elo_baseline |  64 |     0.9719 |  0.5761 |     0.5625 |
| 2018 | blend        |  64 |     0.9778 |  0.5813 |     0.5156 |
| 2018 | linear       |  64 |     0.9778 |  0.5832 |     0.5312 |
| 2018 | classifier   |  64 |     0.9845 |  0.5852 |     0.5000 |
| 2018 | poisson      |  64 |     1.0018 |  0.5994 |     0.5312 |
| 2022 | poisson      |  64 |     1.0744 |  0.6397 |     0.4688 |
| 2022 | blend        |  64 |     1.0749 |  0.6279 |     0.5156 |
| 2022 | classifier   |  64 |     1.0807 |  0.6333 |     0.5000 |
| 2022 | linear       |  64 |     1.0829 |  0.6273 |     0.5156 |
| 2022 | elo_baseline |  64 |     1.0874 |  0.6268 |     0.5312 |
