# World Cup Backtest Report

Walk-forward evaluation: for each World Cup, models are trained only on matches
played *before* that tournament, then scored on its matches.
Blend weights (clf/lin/pois/elo) chosen on post-2014/2018 competitive matches: **(0.375, 0.125, 0.125, 0.375)**.
2022 was not used for weight selection — it is the honest holdout.

Lower log-loss / Brier is better. `elo_baseline` is the bar to beat.

|   wc | model        |   n |   log_loss |   brier |   accuracy |
|-----:|:-------------|----:|-----------:|--------:|-----------:|
| 2014 | elo_baseline |  64 |     0.9095 |  0.5384 |     0.6094 |
| 2014 | linear       |  64 |     0.9143 |  0.5423 |     0.6094 |
| 2014 | blend        |  64 |     0.9171 |  0.5434 |     0.6094 |
| 2014 | classifier   |  64 |     0.9232 |  0.5475 |     0.6250 |
| 2014 | poisson      |  64 |     0.9495 |  0.5665 |     0.6250 |
| 2018 | elo_baseline |  64 |     0.9719 |  0.5761 |     0.5625 |
| 2018 | classifier   |  64 |     0.9792 |  0.5825 |     0.5156 |
| 2018 | blend        |  64 |     0.9797 |  0.5835 |     0.5312 |
| 2018 | poisson      |  64 |     1.0003 |  0.5991 |     0.5312 |
| 2018 | linear       |  64 |     1.0310 |  0.6272 |     0.5156 |
| 2022 | classifier   |  64 |     1.0752 |  0.6305 |     0.5000 |
| 2022 | blend        |  64 |     1.0768 |  0.6293 |     0.5156 |
| 2022 | elo_baseline |  64 |     1.0874 |  0.6268 |     0.5312 |
| 2022 | poisson      |  64 |     1.0900 |  0.6484 |     0.4688 |
| 2022 | linear       |  64 |     1.1168 |  0.6432 |     0.5000 |
