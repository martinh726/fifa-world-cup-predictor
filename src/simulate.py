"""Vectorized Monte Carlo simulation of the 2026 World Cup."""
from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd

from src.tournament import GROUP_LETTERS, assign_third_slots, orient_fixture, parse_slot
from src.train import MAX_GOALS

ET_SHRINK = 0.35  # how much of the 90-minute edge survives extra time + penalties

STAGES = ["group", "r32", "r16", "qf", "sf", "final", "champion"]


class TournamentSimulator:
    def __init__(self, predictor, config: dict, n_sims: int = 10000, seed: int = 42):
        self.predictor = predictor
        self.config = config
        self.n_sims = n_sims
        self.rng = np.random.default_rng(seed)

        self.teams: list[str] = [t for g in config["groups"].values() for t in g]
        self.idx = {t: i for i, t in enumerate(self.teams)}
        self.third_slot_options = tuple(
            (m["match"], parse_slot(m["slot2"])[1])
            for m in config["round_of_32"] if m["slot2"].startswith("3:"))
        self._build_predictions()

    def _build_predictions(self) -> None:
        """One batched model call for every possible pairing of the 48 teams."""
        fixtures = [orient_fixture(a, b, self.config) for a, b in combinations(self.teams, 2)]
        preds = self.predictor.predict_many(fixtures)

        n = len(self.teams)
        self.p_win = np.full((n, n), 0.5)  # P(row beats col in a knockout match, incl ET+pens)
        self.score_mats: dict[tuple[str, str], np.ndarray] = {}
        for p in preds:
            i, j = self.idx[p["home"]], self.idx[p["away"]]
            pa, pdr, pb = p["p_home"], p["p_draw"], p["p_away"]
            q90 = pa / max(pa + pb, 1e-9)
            p_et = 0.5 + ET_SHRINK * (q90 - 0.5)
            self.p_win[i, j] = pa + pdr * p_et
            self.p_win[j, i] = 1.0 - self.p_win[i, j]
            self.score_mats[(p["home"], p["away"])] = p["score_matrix"]

    def _sample_scores(self, team_a: str, team_b: str) -> tuple[np.ndarray, np.ndarray]:
        """Sample (goals_a, goals_b) across all sims for one group fixture."""
        if (team_a, team_b) in self.score_mats:
            mat, flip = self.score_mats[(team_a, team_b)], False
        else:
            mat, flip = self.score_mats[(team_b, team_a)], True
        cells = self.rng.choice(mat.size, size=self.n_sims, p=mat.ravel() / mat.sum())
        s_home, s_away = np.divmod(cells, MAX_GOALS + 1)
        return (s_away, s_home) if flip else (s_home, s_away)

    def run(self, locked_group: list[tuple[str, str, int, int]] | None = None,
            ko_winners: list[tuple[str, str, str]] | None = None) -> dict:
        """Simulate the tournament n_sims times.

        locked_group: real group-stage results (team1, team2, score1, score2) — fixed in every sim.
        ko_winners: decided real knockout matches (team1, team2, winner) — forced when they occur.
        """
        n_sims, rng = self.n_sims, self.rng
        locked = {frozenset((t1, t2)): (t1, t2, s1, s2)
                  for t1, t2, s1, s2 in (locked_group or [])}

        winners, runners = {}, {}
        third_keys = np.zeros((n_sims, 12))
        third_team = np.zeros((n_sims, 12), dtype=np.int64)
        rank_probs: dict[str, pd.DataFrame] = {}

        for gi, (letter, group_teams) in enumerate(self.config["groups"].items()):
            gidx = np.array([self.idx[t] for t in group_teams])
            pts = np.zeros((n_sims, 4))
            gd = np.zeros((n_sims, 4))
            gf = np.zeros((n_sims, 4))
            for la, lb in combinations(range(4), 2):
                ta, tb = group_teams[la], group_teams[lb]
                key = frozenset((ta, tb))
                if key in locked:
                    l1, l2, s1, s2 = locked[key]
                    sa, sb = (s1, s2) if l1 == ta else (s2, s1)
                    sa = np.full(n_sims, sa)
                    sb = np.full(n_sims, sb)
                else:
                    sa, sb = self._sample_scores(ta, tb)
                pts[:, la] += np.where(sa > sb, 3, np.where(sa == sb, 1, 0))
                pts[:, lb] += np.where(sb > sa, 3, np.where(sa == sb, 1, 0))
                gd[:, la] += sa - sb
                gd[:, lb] += sb - sa
                gf[:, la] += sa
                gf[:, lb] += sb

            # composite ranking key: points > GD > GF > random (stand-in for lots/h2h)
            key = pts * 1e9 + gd * 1e4 + gf * 10 + rng.random((n_sims, 4))
            order = np.argsort(-key, axis=1)
            winners[letter] = gidx[order[:, 0]]
            runners[letter] = gidx[order[:, 1]]
            third_local = order[:, 2]
            third_team[:, gi] = gidx[third_local]
            rows = np.arange(n_sims)
            third_keys[:, gi] = (pts[rows, third_local] * 1e9 + gd[rows, third_local] * 1e4
                                 + gf[rows, third_local] * 10 + rng.random(n_sims))

            pos_counts = np.stack([np.bincount(order[:, p], minlength=4) for p in range(4)], axis=1)
            rank_probs[letter] = pd.DataFrame(
                pos_counts / n_sims, index=group_teams, columns=["P(1st)", "P(2nd)", "P(3rd)", "P(4th)"])

        # eight best thirds -> bracket slots (memoized FIFA-style allocation)
        third_order = np.argsort(-third_keys, axis=1)[:, :8]
        masks = np.bitwise_or.reduce(1 << third_order, axis=1)
        third_slot_team = {m: np.zeros(n_sims, dtype=np.int64) for m, _ in self.third_slot_options}
        for mask in np.unique(masks):
            qualified = frozenset(GROUP_LETTERS[b] for b in range(12) if mask >> b & 1)
            assignment = assign_third_slots(qualified, self.third_slot_options)
            sel = masks == mask
            for m, letter in assignment.items():
                third_slot_team[m][sel] = third_team[sel, GROUP_LETTERS.index(letter)]

        forced = [(self.idx[a], self.idx[b], self.idx[w]) for a, b, w in (ko_winners or [])]
        match_winner: dict[int, np.ndarray] = {}

        def resolve(slot: str) -> np.ndarray:
            kind, ref = parse_slot(slot)
            if kind == "winner":
                return winners[ref]
            if kind == "runner_up":
                return runners[ref]
            if kind == "winner_of":
                return match_winner[int(ref)]
            return None  # third slot, handled by match number

        rounds = (self.config["round_of_32"] + self.config["round_of_16"] +
                  self.config["quarterfinals"] + self.config["semifinals"] +
                  [self.config["final"]])
        stage_teams: dict[str, list[np.ndarray]] = {"r32": [], "r16": [], "qf": [], "sf": [], "final": []}

        def stage_of_match(m: int) -> str:
            if m <= 88: return "r32"
            if m <= 96: return "r16"
            if m <= 100: return "qf"
            if m <= 102: return "sf"
            if m == 104: return "final"
            # match 103 is the third-place playoff, which is not part of this simulation
            raise ValueError(f"unexpected match number {m}")

        for match in rounds:
            m = match["match"]
            ta = resolve(match["slot1"])
            tb = resolve(match["slot2"])
            if tb is None:
                tb = third_slot_team[m]
            win_a = rng.random(n_sims) < self.p_win[ta, tb]
            winner = np.where(win_a, ta, tb)
            for fa, fb, fw in forced:
                clash = ((ta == fa) & (tb == fb)) | ((ta == fb) & (tb == fa))
                winner[clash] = fw
            match_winner[m] = winner
            stage = stage_of_match(m)
            if stage in ("r32",):
                stage_teams["r32"].extend([ta, tb])
            # teams *appearing* in later rounds are recorded when produced as winners

        champion = match_winner[self.config["final"]["match"]]

        def reach_probs(arrays: list[np.ndarray]) -> np.ndarray:
            counts = np.zeros(len(self.teams))
            for arr in arrays:
                counts += np.bincount(arr, minlength=len(self.teams))
            return counts / n_sims

        summary = pd.DataFrame({"team": self.teams})
        summary["P(R32)"] = reach_probs(stage_teams["r32"])
        summary["P(R16)"] = reach_probs([match_winner[m["match"]] for m in self.config["round_of_32"]])
        summary["P(QF)"] = reach_probs([match_winner[m["match"]] for m in self.config["round_of_16"]])
        summary["P(SF)"] = reach_probs([match_winner[m["match"]] for m in self.config["quarterfinals"]])
        summary["P(Final)"] = reach_probs([match_winner[m["match"]] for m in self.config["semifinals"]])
        summary["P(Champion)"] = np.bincount(champion, minlength=len(self.teams)) / n_sims
        summary = summary.sort_values("P(Champion)", ascending=False).reset_index(drop=True)

        return {"summary": summary, "rank_probs": rank_probs, "n_sims": n_sims}


if __name__ == "__main__":
    from src.data_loader import load_results, load_shootouts, load_wc2026
    from src.predict import MatchPredictor
    from src.tournament import real_wc_matches

    config = load_wc2026()
    results = load_results()
    mp = MatchPredictor(results=results)

    played = real_wc_matches(results, config)
    group_of = {t: g for g, ts in config["groups"].items() for t in ts}
    locked = [m for m in played if group_of[m[0]] == group_of[m[1]]]
    print(f"Locking {len(locked)} real group results into the simulation.")

    sim = TournamentSimulator(mp, config, n_sims=10000)
    out = sim.run(locked_group=locked)
    print(out["summary"].head(15).to_string(index=False,
          formatters={c: "{:.1%}".format for c in out["summary"].columns if c != "team"}))
