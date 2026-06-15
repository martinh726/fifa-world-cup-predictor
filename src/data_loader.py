"""Download and load the historical international results dataset."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd
import requests

_log = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
WC2026_PATH = PROJECT_ROOT / "data" / "wc2026.json"

BASE_URL = "https://raw.githubusercontent.com/martj42/international_results/master"
FILES = ["results.csv", "shootouts.csv"]


def download_data(force: bool = False) -> None:
    """Download the latest CSVs from GitHub. Skips files that already exist unless force=True."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        dest = RAW_DIR / name
        if dest.exists() and not force:
            continue
        try:
            resp = requests.get(f"{BASE_URL}/{name}", timeout=60)
            resp.raise_for_status()
            if len(resp.content) < 1024:
                _log.warning("download_data: suspiciously small response for %s (%d bytes)", name, len(resp.content))
                if dest.exists():
                    continue
            dest.write_bytes(resp.content)
        except requests.RequestException as e:
            _log.warning("download_data: failed to download %s: %s", name, e)
            if not dest.exists():
                raise


def load_wc2026() -> dict:
    with open(WC2026_PATH, encoding="utf-8") as f:
        return json.load(f)


def _alias_map(config: dict) -> dict[str, str]:
    """Map every known dataset spelling to our canonical team name."""
    mapping = {}
    for canonical, variants in config.get("team_aliases", {}).items():
        for v in variants:
            mapping[v] = canonical
    return mapping


def load_results(download: bool = True) -> pd.DataFrame:
    """Load results.csv with normalized team names, sorted by date."""
    if download:
        download_data()
    df = pd.read_csv(RAW_DIR / "results.csv", parse_dates=["date"])
    df = df.dropna(subset=["home_score", "away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)

    aliases = _alias_map(load_wc2026())
    df["home_team"] = df["home_team"].replace(aliases)
    df["away_team"] = df["away_team"].replace(aliases)

    df = df.sort_values("date").reset_index(drop=True)
    return df


def load_shootouts() -> pd.DataFrame:
    df = pd.read_csv(RAW_DIR / "shootouts.csv", parse_dates=["date"])
    aliases = _alias_map(load_wc2026())
    for col in ("home_team", "away_team", "winner"):
        df[col] = df[col].replace(aliases)
    return df


def validate_teams(results: pd.DataFrame) -> list[str]:
    """Return WC2026 team names that don't appear in the results data."""
    config = load_wc2026()
    teams = {t for group in config["groups"].values() for t in group}
    known = set(results["home_team"]) | set(results["away_team"])
    return sorted(teams - known)


if __name__ == "__main__":
    download_data(force=True)
    results = load_results(download=False)
    print(f"Loaded {len(results):,} matches from {results['date'].min().date()} "
          f"to {results['date'].max().date()}")
    missing = validate_teams(results)
    if missing:
        print(f"MISSING TEAMS (need alias fixes): {missing}")
    else:
        print("All 48 World Cup teams found in the dataset.")
    wc = results[(results["tournament"] == "FIFA World Cup") & (results["date"] >= "2026-06-01")]
    print(f"2026 World Cup matches already in dataset: {len(wc)}")
    if len(wc):
        print(wc[["date", "home_team", "away_team", "home_score", "away_score"]].to_string(index=False))
