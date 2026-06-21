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
    """Group ranking per FIFA 2026 Article 39 tiebreaker order:
    pts → H2H pts → H2H GD → H2H GF → wins (all) → GD (all) → GF (all) → name

    FIFA 2026 change: H2H comes BEFORE overall goal difference/goals scored.
    Previous World Cups used pts → overall GD → overall GF → H2H, but
    FIFA 2026 regulations moved H2H to step 2 (directly after pts).
    This is the reason a team that has lost its H2H match cannot overtake
    an equal-points rival via goal difference alone.
    """
    def table(names: set[str]) -> dict[str, tuple]:
        """(pts, GD, GF, wins) per team, counting only matches between `names`."""
        row = {t: [0, 0, 0, 0] for t in names}
        for t1, t2, s1, s2 in matches:
            if t1 not in names or t2 not in names:
                continue
            for team, gf, ga in ((t1, s1, s2), (t2, s2, s1)):
                row[team][0] += 3 if gf > ga else (1 if gf == ga else 0)
                row[team][1] += gf - ga
                row[team][2] += gf
                row[team][3] += 1 if gf > ga else 0
        return {t: tuple(v) for t, v in row.items()}

    overall = table(set(teams))
    overall_pts  = {t: overall[t][0] for t in teams}
    overall_gd   = {t: overall[t][1] for t in teams}
    overall_gf   = {t: overall[t][2] for t in teams}
    overall_wins = {t: overall[t][3] for t in teams}

    def sort_tied(group: list[str]) -> list[str]:
        """FIFA 2026 Article 39: for teams tied on overall pts, apply
        H2H (pts → GD → GF) first, then wins → overall GD → overall GF → name."""
        h2h = table(set(group))
        h2h3 = {t: h2h[t][:3] for t in group}
        group = sorted(group, key=lambda t: h2h3[t], reverse=True)
        out2: list[str] = []
        j = 0
        while j < len(group):
            still = [t for t in group if h2h3[t] == h2h3[group[j]]]
            if len(still) > 1:
                # After H2H exhausted: wins → overall GD → overall GF → name (asc)
                still = sorted(
                    still,
                    key=lambda t: (-overall_wins[t], -overall_gd[t], -overall_gf[t], t),
                )
            out2.extend(still)
            j += len(still)
        return out2

    # Outer sort: overall pts only (NOT pts+GD+GF — H2H fires before GD in FIFA 2026)
    group = sorted(teams, key=lambda t: overall_pts[t], reverse=True)
    out: list[str] = []
    i = 0
    while i < len(group):
        tied = [t for t in group if overall_pts[t] == overall_pts[group[i]]]
        if len(tied) > 1:
            tied = sort_tied(tied)
        out.extend(tied)
        i += len(tied)
    return out


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

    # FIFA 2026 rule: H2H fires BEFORE overall GD.
    # A and B both 6 pts; B beat A in H2H → B ranks first despite A's better GD.
    ms = [("A", "B", 0, 1), ("C", "D", 1, 1), ("A", "C", 2, 1), ("B", "D", 2, 1),
          ("A", "D", 3, 0), ("B", "C", 1, 2)]
    assert standings(["A", "B", "C", "D"], ms) == ["B", "A", "C", "D"], standings(["A", "B", "C", "D"], ms)

    # A, B, C all on 4 pts / GD 0; 3-way H2H is circular (all tied), then C wins on
    # H2H GF (5 vs 3), then A above B on name (all other criteria equal).
    ms = [("A", "B", 1, 0), ("A", "C", 2, 3), ("B", "C", 3, 2),
          ("A", "D", 1, 1), ("B", "D", 1, 1), ("C", "D", 0, 0)]
    assert standings(["A", "B", "C", "D"], ms) == ["C", "A", "B", "D"], standings(["A", "B", "C", "D"], ms)
    print("standings tiebreaker tests passed")

    slot_opts = tuple((m["match"], parse_slot(m["slot2"])[1])
                      for m in config["round_of_32"] if m["slot2"].startswith("3:"))
    assign = assign_third_slots(frozenset("ABCDFGKL"), slot_opts)
    print("third-place assignment for ABCDFGKL:", assign)
    assert sorted(assign.values()) == sorted("ABCDFGKL"[:8]) or len(set(assign.values())) == 8
