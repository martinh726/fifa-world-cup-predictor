"""SVG bracket renderer — extracted from app.py with no Streamlit dependency."""
from __future__ import annotations

import html


_BRACKET_ORDER = {
    "r32":   [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
    "r16":   [89, 90, 93, 94, 91, 92, 95, 96],
    "qf":    [97, 98, 99, 100],
    "sf":    [101, 102],
    "final": [104],
}


def render_bracket_svg(bracket: dict, flags: dict) -> str:
    """Return a self-contained SVG string for the knockout bracket.

    bracket: dict mapping match_number (int) -> {team1, team2, winner, win_prob, actual}
    flags:   dict mapping team_name -> ISO code (e.g. 'ar' for Argentina)
    """
    CW, CH, RH, SEP = 155, 48, 22, 4
    SLOT_H, GAP, PAD = 70, 45, 8
    STEP = CW + GAP

    r32L = _BRACKET_ORDER["r32"][:8]
    r32R = _BRACKET_ORDER["r32"][8:]
    r16L = _BRACKET_ORDER["r16"][:4]
    r16R = _BRACKET_ORDER["r16"][4:]
    qfL  = _BRACKET_ORDER["qf"][:2]
    qfR  = _BRACKET_ORDER["qf"][2:]
    sfL  = _BRACKET_ORDER["sf"][0]
    sfR  = _BRACKET_ORDER["sf"][1]
    fin  = _BRACKET_ORDER["final"][0]

    r32_yc = [SLOT_H / 2 + i * SLOT_H for i in range(8)]
    r16_yc = [(r32_yc[2 * i] + r32_yc[2 * i + 1]) / 2 for i in range(4)]
    qf_yc  = [(r16_yc[2 * i] + r16_yc[2 * i + 1]) / 2 for i in range(2)]
    sf_yc  = (qf_yc[0] + qf_yc[1]) / 2

    canvas_h = int(r32_yc[-1] + SLOT_H / 2) + 28
    xL = [PAD + i * STEP for i in range(4)]
    x_fin = xL[3] + STEP + 20
    xR = [x_fin + CW + 20 + GAP + i * STEP for i in range(4)]
    canvas_w = xR[3] + CW + PAD

    # Dark cinematic theme (matches frontend ink palette)
    LC = "#474A4A"          # connector lines — Dark Heather Grey
    BG = "#1b1e21"          # canvas
    CARD_BG = "#24272b"     # card fill
    CARD_STROKE = "#3a3e42" # card border
    WIN_BG = "#3CAC3B"      # winner row — host green
    TXT = "#f4f5f6"
    TXT_MUTED = "#8b9094"
    GOLD = "#D4AF37"

    def ln(x1, y1, x2, y2):
        return (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"'
                f' stroke="{LC}" stroke-width="1.5" stroke-linecap="round"/>')

    def elbow_L(xs, ys_src, xd, ys_dst):
        mid = (xs + CW + xd) / 2
        out = []
        for k in range(0, len(ys_src), 2):
            ya, yb, yt = ys_src[k], ys_src[k + 1], ys_dst[k // 2]
            out += [ln(xs + CW, ya, mid, ya), ln(xs + CW, yb, mid, yb),
                    ln(mid, ya, mid, yb), ln(mid, yt, xd, yt)]
        return "".join(out)

    def elbow_R(xs, ys_src, xd, ys_dst):
        mid = (xd + CW + xs) / 2
        out = []
        for k in range(0, len(ys_src), 2):
            ya, yb, yt = ys_src[k], ys_src[k + 1], ys_dst[k // 2]
            out += [ln(xs, ya, mid, ya), ln(xs, yb, mid, yb),
                    ln(mid, ya, mid, yb), ln(xd + CW, yt, mid, yt)]
        return "".join(out)

    def card(x, yc, m_num):
        m = bracket.get(m_num, {})
        t1, t2 = m.get("team1", "TBD"), m.get("team2", "TBD")
        winner, prob, actual = m.get("winner"), m.get("win_prob"), m.get("actual", False)
        y = yc - CH / 2
        t1c, t2c = t1.rstrip("*"), t2.rstrip("*")
        w1 = bool(winner and winner == t1c and flags.get(t1c))
        w2 = bool(winner and winner == t2c and flags.get(t2c))

        def row(t, ry, is_win):
            clean = t.rstrip("*")
            code  = flags.get(clean, "")
            bg = WIN_BG if is_win else CARD_BG
            tc = "#ffffff" if is_win else (TXT if code else TXT_MUTED)
            parts = []
            if is_win:
                parts.append(f'<rect x="{x:.1f}" y="{ry:.1f}" width="{CW}" height="{RH}" fill="{bg}"/>')
            if code:
                parts.append(f'<image href="https://flagcdn.com/w20/{code}.png"'
                             f' x="{x+4:.1f}" y="{ry+4:.1f}" width="18" height="12"/>')
                tx = x + 26
            else:
                tx = x + 6
            name = clean[:17] + "…" if len(clean) > 17 else clean
            if is_win and prob is not None and not actual:
                name += f" {prob:.0%}"
            elif is_win and actual:
                name += " ✓"
            ty, fw = ry + RH - 6, ' font-weight="bold"' if is_win else ""
            italic = ' font-style="italic"' if not code and not is_win else ""
            parts.append(f'<text x="{tx:.1f}" y="{ty:.1f}" fill="{tc}" font-size="11"'
                         f' font-family="Arial,sans-serif"{fw}{italic}>{html.escape(name)}</text>')
            return "".join(parts)

        sep_y = y + RH
        upset = prob is not None and not actual and 0 < prob < 0.60
        badge = (f'<text x="{x+CW-3:.1f}" y="{y+11:.1f}" text-anchor="end" '
                 f'font-size="9" fill="{GOLD}">⚡</text>') if upset else ""
        return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{CW}" height="{CH}"'
                f' rx="4" fill="{CARD_BG}" stroke="{CARD_STROKE}" stroke-width="1"/>'
                + row(t1, y, w1) + badge
                + f'<line x1="{x:.1f}" y1="{sep_y:.1f}" x2="{x+CW:.1f}" y2="{sep_y:.1f}"'
                  f' stroke="{CARD_STROKE}" stroke-width="1"/>'
                + row(t2, y + RH + SEP, w2))

    elems = [
        elbow_L(xL[0], r32_yc, xL[1], r16_yc),
        elbow_L(xL[1], r16_yc, xL[2], qf_yc),
        elbow_L(xL[2], qf_yc,  xL[3], [sf_yc]),
        ln(xL[3] + CW, sf_yc, x_fin, sf_yc),
        elbow_R(xR[3], r32_yc, xR[2], r16_yc),
        elbow_R(xR[2], r16_yc, xR[1], qf_yc),
        elbow_R(xR[1], qf_yc,  xR[0], [sf_yc]),
        ln(xR[0], sf_yc, x_fin + CW, sf_yc),
    ]
    for i, mn in enumerate(r32L): elems.append(card(xL[0], r32_yc[i], mn))
    for i, mn in enumerate(r16L): elems.append(card(xL[1], r16_yc[i], mn))
    for i, mn in enumerate(qfL):  elems.append(card(xL[2], qf_yc[i],  mn))
    elems.append(card(xL[3], sf_yc, sfL))
    elems.append(card(x_fin,  sf_yc, fin))
    elems.append(card(xR[0],  sf_yc, sfR))
    for i, mn in enumerate(qfR):  elems.append(card(xR[1], qf_yc[i],  mn))
    for i, mn in enumerate(r16R): elems.append(card(xR[2], r16_yc[i], mn))
    for i, mn in enumerate(r32R): elems.append(card(xR[3], r32_yc[i], mn))

    ly = canvas_h - 4
    for lx, label in [
        (xL[0]+CW/2, "R32"), (xL[1]+CW/2, "R16"), (xL[2]+CW/2, "QF"),
        (xL[3]+CW/2, "SF"), (x_fin+CW/2, "Final"),
        (xR[0]+CW/2, "SF"), (xR[1]+CW/2, "QF"), (xR[2]+CW/2, "R16"), (xR[3]+CW/2, "R32"),
    ]:
        elems.append(f'<text x="{lx:.1f}" y="{ly}" text-anchor="middle"'
                     f' fill="{TXT_MUTED}" font-size="10" font-family="Arial,sans-serif">{label}</text>')

    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{canvas_w:.0f}" height="{canvas_h:.0f}">'
            f'<rect width="100%" height="100%" fill="{BG}"/>'
            + "".join(elems) + '</svg>')


def build_live_bracket(group_results_all: list, ko_results_all: list, config: dict) -> dict:
    """Build bracket data from actual group standings and knockout results."""
    from src.tournament import standings, parse_slot, assign_third_slots
    from backend.utils import third_place_race

    group_of = {t: g for g, ts in config["groups"].items() for t in ts}
    stage_map = (
        {m["match"]: "r32" for m in config["round_of_32"]} |
        {m["match"]: "r16" for m in config["round_of_16"]} |
        {m["match"]: "qf"  for m in config["quarterfinals"]} |
        {m["match"]: "sf"  for m in config["semifinals"]} |
        {config["final"]["match"]: "final"}
    )

    group_match_count: dict[str, int] = {}
    for t1, *_ in group_results_all:
        g = group_of.get(t1)
        if g:
            group_match_count[g] = group_match_count.get(g, 0) + 1

    group_order: dict[str, list[str]] = {}
    for letter, teams in config["groups"].items():
        ms = [m for m in group_results_all if group_of.get(m[0]) == letter]
        if ms:
            group_order[letter] = standings(teams, ms)

    # Resolve third-place bracket slots using the real top-8 thirds.
    # slot_options: tuple of (match_number, allowed_group_letters) for every R32 "3:" slot.
    slot_options = tuple(
        (
            m["match"],
            tuple(m["slot2"][2:] if m["slot2"].startswith("3:") else m["slot1"][2:]),
        )
        for m in config["round_of_32"]
        if m["slot1"].startswith("3:") or m["slot2"].startswith("3:")
    )
    thirds = third_place_race(config, group_results_all)
    third_slot_map: dict[int, str] = {}

    # Prefer the ACTUALLY PLAYED opponent over the computed assignment where
    # possible: assign_third_slots() only guarantees *a* valid pairing that
    # satisfies each slot's allowed-group constraint, but several valid
    # pairings can exist and only one matches what FIFA's official draw (and
    # thus the real bracket) actually used. Every R32 "3:" slot is paired
    # with a "1X" group-winner slot, so once that group winner's real match
    # has been played, read the true third-place opponent off the result
    # instead of trusting the solver's guess.
    #
    # ko_results_all carries no round marker, so a team that has advanced
    # past R32 has one entry per round played and a naive "last write wins"
    # map could pick up their R16+ opponent instead of their R32 one. Only
    # trust an entry where EXACTLY one side is a genuine third-place
    # qualifier — group winners only ever face a third-place team in R32,
    # so that shape uniquely identifies the R32 "1X vs 3:" match.
    third_place_pool = {t["team"] for t in thirds}
    ko_opponent: dict[str, str] = {}
    for t1, t2, _w in ko_results_all:
        t1_third, t2_third = t1 in third_place_pool, t2 in third_place_pool
        if t1_third and not t2_third:
            ko_opponent[t2] = t1
        elif t2_third and not t1_third:
            ko_opponent[t1] = t2

    pinned_groups: set[str] = set()
    for m in config["round_of_32"]:
        if not (m["slot1"].startswith("3:") or m["slot2"].startswith("3:")):
            continue
        winner_slot = m["slot2"] if m["slot1"].startswith("3:") else m["slot1"]
        order = group_order.get(winner_slot[1:], [])
        if not order:
            continue
        opponent = ko_opponent.get(order[0])
        opp_group = group_of.get(opponent) if opponent else None
        if opponent and opp_group:
            third_slot_map[m["match"]] = opponent
            pinned_groups.add(opp_group)

    if len(thirds) >= 8:
        top8_groups = frozenset(t["group"] for t in thirds[:8]) - pinned_groups
        remaining_slot_options = tuple(
            (mnum, allowed) for mnum, allowed in slot_options if mnum not in third_slot_map
        )
        group_assignment = assign_third_slots(top8_groups, remaining_slot_options)
        group_to_team = {t["group"]: t["team"] for t in thirds}
        for match_num, grp in group_assignment.items():
            team = group_to_team.get(grp)
            if team:
                third_slot_map[match_num] = team

    ko_won = {frozenset((t1, t2)): w for t1, t2, w in ko_results_all}
    match_to_winner: dict[int, str] = {}

    def resolve(slot: str, match_num: int = 0) -> str:
        if slot.startswith("1"):
            g = slot[1:]
            order = group_order.get(g, [])
            done = group_match_count.get(g, 0) >= 6
            if order:
                return order[0] if done else order[0] + "*"
            return f"1st Gp {g}"
        if slot.startswith("2"):
            g = slot[1:]
            order = group_order.get(g, [])
            done = group_match_count.get(g, 0) >= 6
            if len(order) >= 2:
                return order[1] if done else order[1] + "*"
            return f"2nd Gp {g}"
        if slot.startswith("3:"):
            return third_slot_map.get(match_num, "Best 3rd")
        if slot.startswith("W"):
            m = int(slot[1:])
            return match_to_winner.get(m, f"W{m}")
        return slot

    bracket: dict[int, dict] = {}
    all_ko = (config["round_of_32"] + config["round_of_16"] +
              config["quarterfinals"] + config["semifinals"] + [config["final"]])
    for match in all_ko:
        m = match["match"]
        t1, t2 = resolve(match["slot1"], m), resolve(match["slot2"], m)
        winner = ko_won.get(frozenset((t1.rstrip("*"), t2.rstrip("*"))))
        if winner:
            match_to_winner[m] = winner
        bracket[m] = {
            "match": m, "stage": stage_map[m],
            "team1": t1, "team2": t2,
            "winner": winner, "win_prob": None, "actual": winner is not None,
        }
    return bracket
