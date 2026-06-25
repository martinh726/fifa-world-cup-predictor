"""Feature engineering shared by training (historical matches) and prediction (future matches)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from src.elo import k_factor

# Ordinal match-importance from the Elo K-factor (20..60 -> 0..4)
IMPORTANCE = {20: 0, 30: 1, 40: 2, 50: 3, 60: 4}

DEFAULT_H2H_PPG = 1.4  # prior when two teams have never met
MAX_REST_DAYS = 60.0

FEATURES = [
    "elo_home", "elo_away", "elo_diff",
    "gf5_home", "ga5_home", "ppg5_home", "gf10_home", "ga10_home", "ppg10_home", "ppg25_home",
    "gf5_away", "ga5_away", "ppg5_away", "gf10_away", "ga10_away", "ppg10_away", "ppg25_away",
    "rest_home", "rest_away",
    "h2h_ppg_home", "h2h_n",
    "importance", "neutral",
    "altitude_m",
    # Cumulative form within the current World Cup (NaN for non-WC matches → imputed)
    "wc_ppg_home", "wc_ppg_away", "wc_gd_home", "wc_gd_away",
]

_ROLL_COLS = ["gf5", "ga5", "ppg5", "gf10", "ga10", "ppg10", "ppg25"]


def _long_format(df: pd.DataFrame) -> pd.DataFrame:
    """One row per (match, team) with goals for/against and points."""
    home = pd.DataFrame({
        "midx": df.index, "date": df["date"], "team": df["home_team"],
        "gf": df["home_score"], "ga": df["away_score"], "is_home": True,
    })
    away = pd.DataFrame({
        "midx": df.index, "date": df["date"], "team": df["away_team"],
        "gf": df["away_score"], "ga": df["home_score"], "is_home": False,
    })
    long = pd.concat([home, away], ignore_index=True)
    long["points"] = np.select([long.gf > long.ga, long.gf == long.ga], [3.0, 1.0], 0.0)
    return long.sort_values(["team", "date", "midx"]).reset_index(drop=True)


def _add_rolling(long: pd.DataFrame, shifted: bool) -> pd.DataFrame:
    """Rolling form per team using EWMA (exponential recency decay, span=window).
    shifted=True excludes the current match (training);
    shifted=False includes it (snapshot of form *after* the latest matches)."""
    g = long.groupby("team", sort=False)

    for col, window, name in [("gf", 5, "gf5"), ("ga", 5, "ga5"), ("points", 5, "ppg5"),
                              ("gf", 10, "gf10"), ("ga", 10, "ga10"), ("points", 10, "ppg10"),
                              ("points", 25, "ppg25")]:
        src = g[col].shift(1) if shifted else long[col]
        long[name] = src.groupby(long["team"]).transform(
            lambda x, w=window: x.ewm(span=w, min_periods=1).mean()
        )
    long["rest"] = g["date"].diff().dt.days.clip(upper=MAX_REST_DAYS).fillna(MAX_REST_DAYS)
    return long


def _h2h(df: pd.DataFrame) -> pd.DataFrame:
    """Prior head-to-head points-per-game from the home team's perspective."""
    home_is_first = df["home_team"] <= df["away_team"]
    first = df["home_team"].where(home_is_first, df["away_team"])
    second = df["away_team"].where(home_is_first, df["home_team"])
    home_pts = np.select([df.home_score > df.away_score, df.home_score == df.away_score], [3.0, 1.0], 0.0)
    away_pts = np.where(home_pts == 1.0, 1.0, 3.0 - home_pts)

    tmp = pd.DataFrame({
        "pair": first.str.cat(second, sep="|"),
        "pts_first": np.where(home_is_first, home_pts, away_pts),
        "pts_second": np.where(home_is_first, away_pts, home_pts),
    }, index=df.index)
    grp = tmp.groupby("pair", sort=False)
    n_prior = grp.cumcount().astype(float)
    cum_first_prior = grp["pts_first"].cumsum() - tmp["pts_first"]
    cum_second_prior = grp["pts_second"].cumsum() - tmp["pts_second"]
    ppg_first = np.where(n_prior > 0, cum_first_prior / np.maximum(n_prior, 1), DEFAULT_H2H_PPG)
    ppg_second = np.where(n_prior > 0, cum_second_prior / np.maximum(n_prior, 1), DEFAULT_H2H_PPG)

    out = pd.DataFrame(index=df.index)
    out["h2h_ppg_home"] = np.where(home_is_first, ppg_first, ppg_second)
    out["h2h_ppg_away"] = np.where(home_is_first, ppg_second, ppg_first)
    out["h2h_n"] = n_prior
    return out


def _wc_form(df: pd.DataFrame) -> pd.DataFrame:
    """Cumulative PPG and avg GD accumulated within each World Cup before each match.

    For the first match of a team's WC campaign the feature is NaN (no prior data).
    Non-WC rows are NaN and handled by the imputer downstream.
    """
    wc = df[df["tournament"] == "FIFA World Cup"].copy()
    if wc.empty:
        return pd.DataFrame(index=df.index,
                            columns=["wc_ppg_home", "wc_ppg_away", "wc_gd_home", "wc_gd_away"],
                            dtype=float)
    long = _long_format(wc)
    long["gd"] = long["gf"] - long["ga"]
    long["wc_year"] = long["date"].dt.year

    g = long.groupby(["team", "wc_year"], sort=False)
    # Cumulative totals before each match (shift by 1 so current match excluded)
    long["cum_pts"] = g["points"].transform(lambda s: s.shift(1).cumsum())
    long["cum_gd"]  = g["gd"].transform(lambda s: s.shift(1).cumsum())
    long["n"]       = g.cumcount()  # number of WC matches played before this one

    long["wc_ppg"] = np.where(long["n"] > 0, long["cum_pts"] / long["n"], np.nan)
    long["wc_gd"]  = np.where(long["n"] > 0, long["cum_gd"]  / long["n"], np.nan)

    home_wc = long[long["is_home"]].set_index("midx")[["wc_ppg", "wc_gd"]]
    away_wc = long[~long["is_home"]].set_index("midx")[["wc_ppg", "wc_gd"]]

    out = pd.DataFrame(index=df.index)
    out["wc_ppg_home"] = home_wc["wc_ppg"]
    out["wc_ppg_away"] = away_wc["wc_ppg"]
    out["wc_gd_home"]  = home_wc["wc_gd"]
    out["wc_gd_away"]  = away_wc["wc_gd"]
    return out


def current_wc_stats(df: pd.DataFrame) -> dict[str, tuple[float, float]]:
    """PPG and avg GD for every team in the most recent World Cup (all games played).

    Used at prediction time to inject live tournament form into make_future_row.
    Returns {team: (wc_ppg, wc_gd_avg)}.
    """
    wc = df[df["tournament"] == "FIFA World Cup"]
    if wc.empty:
        return {}
    latest_year = int(wc["date"].dt.year.max())
    long = _long_format(wc[wc["date"].dt.year == latest_year])
    long["gd"] = long["gf"] - long["ga"]
    return {
        team: (float(grp["points"].mean()), float(grp["gd"].mean()))
        for team, grp in long.groupby("team")
    }


def build_match_features(df: pd.DataFrame, min_year: int = 1990,
                          city_altitude: dict | None = None) -> pd.DataFrame:
    """Build the training table from results that already carry pre-match Elo columns.

    Returns one row per match with FEATURES, plus targets:
    outcome (0=home win, 1=draw, 2=away win), home_score, away_score, date, teams.
    city_altitude: optional {city: metres} lookup; if None, altitude_m is 0 for all rows.
    """
    # Rolling form from competitive matches only — pre-tournament friendly results
    # (where starters are rested and tactics are experimental) pollute the form signal.
    comp = df[df["tournament"] != "Friendly"]
    comp_long = _add_rolling(_long_format(comp), shifted=True)
    home_comp = comp_long[comp_long["is_home"]].set_index("midx")
    away_comp = comp_long[~comp_long["is_home"]].set_index("midx")

    # Rest days from ALL matches — friendlies still consume legs and travel time.
    long_full = _long_format(df)
    g_full = long_full.groupby("team", sort=False)
    long_full["rest"] = g_full["date"].diff().dt.days.clip(upper=MAX_REST_DAYS).fillna(MAX_REST_DAYS)
    home_full = long_full[long_full["is_home"]].set_index("midx")
    away_full = long_full[~long_full["is_home"]].set_index("midx")

    feat = pd.DataFrame(index=df.index)
    feat["elo_home"] = df["home_elo_pre"]
    feat["elo_away"] = df["away_elo_pre"]
    feat["elo_diff"] = df["home_elo_pre"] - df["away_elo_pre"]
    for c in _ROLL_COLS:
        feat[f"{c}_home"] = home_comp[c]  # NaN for friendly rows — imputed downstream
        feat[f"{c}_away"] = away_comp[c]
    feat["rest_home"] = home_full["rest"]
    feat["rest_away"] = away_full["rest"]
    feat[["h2h_ppg_home", "h2h_ppg_away", "h2h_n"]] = _h2h(df)
    feat[["wc_ppg_home", "wc_ppg_away", "wc_gd_home", "wc_gd_away"]] = _wc_form(df)
    feat["importance"] = df["tournament"].map(lambda t: IMPORTANCE[k_factor(t)])
    feat["neutral"] = df["neutral"].astype(int)
    if city_altitude and "city" in df.columns:
        feat["altitude_m"] = df["city"].map(lambda c: city_altitude.get(c, 0.0))
    else:
        feat["altitude_m"] = 0.0

    feat["outcome"] = np.select(
        [df.home_score > df.away_score, df.home_score == df.away_score], [0, 1], 2)
    feat["home_score"] = df["home_score"]
    feat["away_score"] = df["away_score"]
    feat["date"] = df["date"]
    feat["home_team"] = df["home_team"]
    feat["away_team"] = df["away_team"]
    feat["tournament"] = df["tournament"]

    return feat[feat["date"].dt.year >= min_year].copy()


def swap_orientation(feats: pd.DataFrame) -> pd.DataFrame:
    """Return the feature table with home/away perspectives exchanged.

    Used to symmetrize predictions for neutral-venue matches: predict both
    orientations and average, so the arbitrary 'home' label carries no signal.
    """
    out = feats.copy()
    swaps = {
        "elo_home": "elo_away", "rest_home": "rest_away", "h2h_ppg_home": "h2h_ppg_away",
        "wc_ppg_home": "wc_ppg_away", "wc_gd_home": "wc_gd_away",
    }
    swaps.update({f"{c}_home": f"{c}_away" for c in _ROLL_COLS})
    rename = {}
    for a, b in swaps.items():
        rename[a], rename[b] = b, a
    out = out.rename(columns=rename)
    out["elo_diff"] = -out["elo_diff"]
    return out


def latest_team_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Current form snapshot per team using competitive matches only."""
    comp = df[df["tournament"] != "Friendly"]
    long = _add_rolling(_long_format(comp), shifted=False)
    last = long.groupby("team").tail(1).set_index("team")
    return last[_ROLL_COLS + ["date"]]


def h2h_lookup(df: pd.DataFrame, team_a: str, team_b: str) -> tuple[float, float]:
    """(points-per-game for team_a in all prior meetings, number of meetings)."""
    m = df[((df.home_team == team_a) & (df.away_team == team_b)) |
           ((df.home_team == team_b) & (df.away_team == team_a))].tail(10)
    if m.empty:
        return DEFAULT_H2H_PPG, 0.0
    a_is_home = m["home_team"] == team_a
    a_goals = np.where(a_is_home, m["home_score"], m["away_score"])
    b_goals = np.where(a_is_home, m["away_score"], m["home_score"])
    pts = np.select([a_goals > b_goals, a_goals == b_goals], [3.0, 1.0], 0.0)
    return float(pts.mean()), float(len(m))


def make_future_row(home: str, away: str, stats: pd.DataFrame, ratings: dict[str, float],
                    h2h: tuple[float, float], neutral: bool, as_of: pd.Timestamp,
                    importance: int = 4, altitude: float = 0.0,
                    wc_stats: dict | None = None) -> dict:
    """Single feature row for a hypothetical future match.

    altitude: metres above sea level for the match venue (0 = sea level / unknown).
    wc_stats: {team: (wc_ppg, wc_gd_avg)} from current_wc_stats(); None outside WC context.
    """
    row: dict = {
        "elo_home": ratings.get(home, 1500.0),
        "elo_away": ratings.get(away, 1500.0),
        "importance": importance,
        "neutral": int(neutral),
        "h2h_ppg_home": h2h[0],
        "h2h_n": h2h[1],
        "altitude_m": float(altitude),
    }
    row["elo_diff"] = row["elo_home"] - row["elo_away"]
    for side, team in (("home", home), ("away", away)):
        if team in stats.index:
            s = stats.loc[team]
            for c in _ROLL_COLS:
                row[f"{c}_{side}"] = float(s[c])
            row[f"rest_{side}"] = float(min((as_of - s["date"]).days, MAX_REST_DAYS))
        else:
            for c in _ROLL_COLS:
                row[f"{c}_{side}"] = np.nan
            row[f"rest_{side}"] = MAX_REST_DAYS
        wc = (wc_stats or {}).get(team)
        row[f"wc_ppg_{side}"] = wc[0] if wc else np.nan
        row[f"wc_gd_{side}"]  = wc[1] if wc else np.nan
    return row
