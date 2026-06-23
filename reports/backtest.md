# World Cup Backtest Report

Walk-forward evaluation: for each World Cup, models are trained only on matches
played *before* that tournament, then scored on its matches.
Blend weights (clf/lin/pois/elo) chosen on post-2014/2018 competitive matches: **(0.125, 0.375, 0.125, 0.375)**.
2022 was not used for weight selection — it is the honest holdout.

Lower log-loss / Brier is better. `elo_baseline` is the bar to beat.

|   wc | model        |   n |   log_loss |   brier |   accuracy |
|-----:|:-------------|----:|-----------:|--------:|-----------:|
| 2014 | elo_baseline |  64 |     0.9068 |  0.5362 |     0.6094 |
| 2014 | linear       |  64 |     0.9085 |  0.5375 |     0.5938 |
| 2014 | blend        |  64 |     0.9138 |  0.5403 |     0.6094 |
| 2014 | classifier   |  64 |     0.9337 |  0.5518 |     0.5938 |
| 2014 | poisson      |  64 |     0.9522 |  0.5675 |     0.6250 |
| 2018 | elo_baseline |  64 |     0.9649 |  0.5717 |     0.5625 |
| 2018 | blend        |  64 |     0.9743 |  0.5791 |     0.5312 |
| 2018 | linear       |  64 |     0.9826 |  0.5850 |     0.5156 |
| 2018 | classifier   |  64 |     0.9827 |  0.5842 |     0.5312 |
| 2018 | poisson      |  64 |     0.9964 |  0.5961 |     0.5312 |
| 2022 | poisson      |  64 |     1.0590 |  0.6297 |     0.4688 |
| 2022 | classifier   |  64 |     1.0770 |  0.6303 |     0.5000 |
| 2022 | blend        |  64 |     1.0782 |  0.6309 |     0.5156 |
| 2022 | elo_baseline |  64 |     1.0840 |  0.6286 |     0.5156 |
| 2022 | linear       |  64 |     1.0950 |  0.6404 |     0.5156 |
