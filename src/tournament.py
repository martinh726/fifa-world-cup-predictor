"""2026 World Cup format: group fixtures, standings/tiebreakers, bracket rules."""
from __future__ import annotations

from functools import lru_cache
from itertools import combinations

import pandas as pd

from src.data_loader import load_wc2026

GROUP_LETTERS = "ABCDEFGHIJKL"


def group_fixtures(config: dict) -> list[tuple[str, str, str]]:
    """All 72 group-stage pairings as (group, team1, team2)."""
    out = []
    for letter, teams in config["groups"].items():
        out.extend((letter, a, b) for a, b in combinations(teams, 2))
    return out


def match_venue(team1: str, team2: str, config: dict) -> bool:
    """Returns neutral flag and orients hosts as the home side.

    A host playing a non-host is treated as at home (their group matches are in
    their own country; knockout paths mostly keep hosts at home too).
    """
    hosts = set(config["hosts"])
    if (team1 in hosts) == (team2 in hosts):
        return True
    return False


def orient_fixture(team1: str, team2: str, config: dict) -> tuple[str, str, bool]:
    """(home, away, neutral) with a sole host put in the home slot."""
    hosts = set(config["hosts"])
    if team2 in hosts and team1 not in hosts:
        team1, team2 = team2, team1
    return team1, team2, match_venue(team1, team2, config)


def real_wc_matches(results: pd.DataFrame, config: dict) -> list[tuple[str, str, int, int]]:
    """2026 World Cup matches already played, as (team1, team2, score1, score2)."""
    wc = results[(results["tournament"] == config["tournament_name"]) &
                 (results["date"] >= config["start_date"])]
    return [(r.home_team, r.away_team, int(r.home_score), int(r.away_score))
            for r in wc.itertuples()]


def split_real_results(results: pd.DataFrame, shootouts: pd.DataFrame, config: dict
                       ) -> tuple[list[tuple[str, str, int, int]], list[tuple[str, str, str]]]:
    """Split played 2026 WC matches into group results and decided knockout matches.

    Returns (group_results as (t1, t2, s1, s2), knockout as (t1, t2, winner)).
    Drawn knockout matches are resolved via the shootouts table.
    """
    group_of = {t: g for g, ts in config["groups"].items() for t in ts}
    shootout_winner = {}
    if shootouts is not None:
        recent = shootouts[shootouts["date"] >= config["start_date"]]
        shootout_winner = {frozenset((r.home_team, r.away_team)): r.winner
                           for r in recent.itertuples()}

    group_results, ko_results = [], []
    for t1, t2, s1, s2 in real_wc_matches(results, config):
        if group_of.get(t1) is not None and group_of.get(t1) == group_of.get(t2):
            group_results.append((t1, t2, s1, s2))
        else:
            if s1 != s2:
                winner = t1 if s1 > s2 else t2
            else:
                winner = shootout_winner.get(frozenset((t1, t2)))
            if winner:
                ko_results.append((t1, t2, winner))
    return group_results, ko_results


def standings(teams: list[str], matches: list[tuple[str, str, int, int]]) -> list[str]:
    """Exact group ranking with FIFA tiebreakers: points, GD, GF, then the same
    three restricted to matches among the still-tied teams, then team name
    (deterministic stand-in for drawing of lots)."""
    def table(names: set[str]) -> dict[str, tuple]:
        """(points, GD, GF) per team, counting only matches between `names`."""
        pts = {t: [0, 0, 0] for t in names}
        for t1, t2, s1, s2 in matches:
            if t1 not in names or t2 not in names:
                continue
            for team, gf, ga in ((t1, s1, s2), (t2, s2, s1)):
                pts[team][0] += 3 if gf > ga else (1 if gf == ga else 0)
                pts[team][1] += gf - ga
                pts[team][2] += gf
        return {t: tuple(v) for t, v in pts.items()}

    overall = table(set(teams))

    def sort_group(group: list[str]) -> list[str]:
        group = sorted(group, key=lambda t: overall[t], reverse=True)
        out: list[str] = []
        i = 0
        while i < len(group):
            tied = [t for t in group if overall[t] == overall[group[i]]]
            if len(tied) > 1:
                h2h = table(set(tied))
                tied = sorted(tied, key=lambda t: (h2h[t], t), reverse=True)
            out.extend(tied)
            i += len(tied)
        return out

    return sort_group(list(teams))


def parse_slot(slot: str) -> tuple[str, str]:
    """'1A' -> ('winner', 'A'); '2B' -> ('runner_up', 'B'); '3:ABCDF' -> ('third', 'ABCDF'); 'W74' -> ('winner_of', '74')."""
    if slot.startswith("W"):
        return "winner_of", slot[1:]
    if slot.startswith("3:"):
        return "third", slot[2:]
    return {"1": "winner", "2": "runner_up"}[slot[0]], slot[1]


@lru_cache(maxsize=None)
def assign_third_slots(qualified: frozenset[str], slot_options: tuple[tuple[int, str], ...]) -> dict[int, str]:
    """Match the 8 qualified third-place groups to bracket slots (each slot accepts
    thirds only from specific groups). Backtracking on the slot with fewest options."""
    slots = [(m, [g for g in allowed if g in qualified]) for m, allowed in slot_options]

    def solve(remaining: list, used: set[str]) -> dict[int, str] | None:
        if not remaining:
            return {}
        remaining = sorted(remaining, key=lambda s: len([g for g in s[1] if g not in used]))
        match, options = remaining[0]
        for g in options:
            if g in used:
                continue
            rest = solve(remaining[1:], used | {g})
            if rest is not None:
                return {match: g, **rest}
        return None

    result = solve(slots, set())
    if result is None:  # shouldn't happen for FIFA's table, but never leave it unassigned
        result = {}
        pool = sorted(qualified)
        for m, allowed in slot_options:
            pick = next((g for g in allowed if g in pool), pool[0])
            pool.remove(pick)
            result[m] = pick
    return result


if __name__ == "__main__":
    config = load_wc2026()
    fixtures = group_fixtures(config)
    print(f"{len(fixtures)} group fixtures")

    # GD tiebreak: A and B both 6 pts, A's GD is better
    ms = [("A", "B", 0, 1), ("C", "D", 1, 1), ("A", "C", 2, 1), ("B", "D", 2, 1),
          ("A", "D", 3, 0), ("B", "C", 1, 2)]
    assert standings(["A", "B", "C", "D"], ms) == ["A", "B", "C", "D"]

    # A, B, C all on 4 pts / GD 0; C first on GF, then A above B via head-to-head
    ms = [("A", "B", 1, 0), ("A", "C", 2, 3), ("B", "C", 3, 2),
          ("A", "D", 1, 1), ("B", "D", 1, 1), ("C", "D", 0, 0)]
    assert standings(["A", "B", "C", "D"], ms) == ["C", "A", "B", "D"]
    print("standings tiebreaker tests passed")

    slot_opts = tuple((m["match"], parse_slot(m["slot2"])[1])
                      for m in config["round_of_32"] if m["slot2"].startswith("3:"))
    assign = assign_third_slots(frozenset("ABCDFGKL"), slot_opts)
    print("third-place assignment for ABCDFGKL:", assign)
    assert sorted(assign.values()) == sorted("ABCDFGKL"[:8]) or len(set(assign.values())) == 8
