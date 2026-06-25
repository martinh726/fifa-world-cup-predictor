# World Cup Backtest Report

Walk-forward evaluation: for each World Cup, models are trained only on matches
played *before* that tournament, then scored on its matches.
Blend weights (clf/lin/pois/elo) chosen on post-2014/2018 competitive matches: **(0.275, 0.2, 0.125, 0.4)**.
2022 was not used for weight selection — it is the honest holdout.

Lower log-loss / Brier is better. `elo_baseline` is the bar to beat.

|   wc | model        |   n |   log_loss |   brier |   accuracy |
|-----:|:-------------|----:|-----------:|--------:|-----------:|
| 2014 | elo_baseline |  64 |     0.9012 |  0.5322 |     0.6094 |
| 2014 | blend        |  64 |     0.9104 |  0.5386 |     0.6094 |
| 2014 | linear       |  64 |     0.9120 |  0.5408 |     0.6094 |
| 2014 | classifier   |  64 |     0.9208 |  0.5461 |     0.6094 |
| 2014 | poisson      |  64 |     0.9536 |  0.5696 |     0.6250 |
| 2018 | elo_baseline |  64 |     0.9705 |  0.5747 |     0.5625 |
| 2018 | classifier   |  64 |     0.9730 |  0.5796 |     0.5312 |
| 2018 | blend        |  64 |     0.9799 |  0.5842 |     0.5312 |
| 2018 | poisson      |  64 |     1.0049 |  0.6023 |     0.5156 |
| 2018 | linear       |  64 |     1.0323 |  0.6266 |     0.5000 |
| 2022 | classifier   |  64 |     1.0542 |  0.6199 |     0.5312 |
| 2022 | blend        |  64 |     1.0751 |  0.6276 |     0.5156 |
| 2022 | poisson      |  64 |     1.0902 |  0.6492 |     0.4688 |
| 2022 | elo_baseline |  64 |     1.0943 |  0.6284 |     0.5312 |
| 2022 | linear       |  64 |     1.1316 |  0.6478 |     0.5156 |
