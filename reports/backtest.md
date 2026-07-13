# World Cup Backtest Report

Walk-forward evaluation: for each World Cup, models are trained only on matches
played *before* that tournament, then scored on its matches.
Blend weights (clf/lin/pois/elo) chosen on post-2014/2018 competitive matches: **(0.2, 0.225, 0.125, 0.45)**.
2022 was not used for weight selection — it is the honest holdout.

Lower log-loss / Brier is better. `elo_baseline` is the bar to beat.

|   wc | model        |   n |   log_loss |   brier |   accuracy |
|-----:|:-------------|----:|-----------:|--------:|-----------:|
| 2014 | elo_baseline |  64 |     0.9012 |  0.5322 |     0.6094 |
| 2014 | blend        |  64 |     0.9112 |  0.5391 |     0.6094 |
| 2014 | linear       |  64 |     0.9119 |  0.5408 |     0.6094 |
| 2014 | classifier   |  64 |     0.9305 |  0.5514 |     0.5938 |
| 2014 | poisson      |  64 |     0.9542 |  0.5701 |     0.6250 |
| 2018 | elo_baseline |  64 |     0.9705 |  0.5747 |     0.5625 |
| 2018 | classifier   |  64 |     0.9806 |  0.5847 |     0.5312 |
| 2018 | blend        |  64 |     0.9824 |  0.5859 |     0.5312 |
| 2018 | poisson      |  64 |     1.0038 |  0.6013 |     0.5312 |
| 2018 | linear       |  64 |     1.0329 |  0.6271 |     0.5000 |
| 2022 | classifier   |  64 |     1.0666 |  0.6249 |     0.5312 |
| 2022 | blend        |  64 |     1.0813 |  0.6294 |     0.5156 |
| 2022 | poisson      |  64 |     1.0914 |  0.6500 |     0.4688 |
| 2022 | elo_baseline |  64 |     1.0943 |  0.6284 |     0.5312 |
| 2022 | linear       |  64 |     1.1314 |  0.6478 |     0.5156 |
