# World Cup Backtest Report

Walk-forward evaluation: for each World Cup, models are trained only on matches
played *before* that tournament, then scored on its matches.
Blend weights (clf/lin/pois/elo) chosen on post-2014/2018 competitive matches: **(0.3, 0.2, 0.125, 0.375)**.
2022 was not used for weight selection — it is the honest holdout.

Lower log-loss / Brier is better. `elo_baseline` is the bar to beat.

|   wc | model        |   n |   log_loss |   brier |   accuracy |
|-----:|:-------------|----:|-----------:|--------:|-----------:|
| 2014 | elo_baseline |  64 |     0.9012 |  0.5322 |     0.6094 |
| 2014 | linear       |  64 |     0.9114 |  0.5404 |     0.6094 |
| 2014 | blend        |  64 |     0.9128 |  0.5404 |     0.6094 |
| 2014 | classifier   |  64 |     0.9280 |  0.5511 |     0.5938 |
| 2014 | poisson      |  64 |     0.9541 |  0.5700 |     0.6250 |
| 2018 | elo_baseline |  64 |     0.9704 |  0.5747 |     0.5625 |
| 2018 | classifier   |  64 |     0.9710 |  0.5801 |     0.5469 |
| 2018 | blend        |  64 |     0.9795 |  0.5845 |     0.5469 |
| 2018 | poisson      |  64 |     1.0037 |  0.6013 |     0.5312 |
| 2018 | linear       |  64 |     1.0329 |  0.6270 |     0.5000 |
| 2022 | classifier   |  64 |     1.0602 |  0.6210 |     0.5156 |
| 2022 | blend        |  64 |     1.0769 |  0.6278 |     0.5156 |
| 2022 | poisson      |  64 |     1.0914 |  0.6500 |     0.4688 |
| 2022 | elo_baseline |  64 |     1.0944 |  0.6284 |     0.5312 |
| 2022 | linear       |  64 |     1.1319 |  0.6478 |     0.5156 |
