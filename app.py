"""2026 FIFA World Cup predictor — Streamlit dashboard."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.data_loader import download_data, load_results, load_shootouts, load_wc2026
from src.livefeed import fetch_finished_matches, fetch_live_matches, fetch_todays_matches, get_api_key
from src.predict import MatchPredictor, ingame_probs
from src.simulate import TournamentSimulator
from src.tournament import split_real_results, standings

st.set_page_config(page_title="2026 World Cup Predictor", page_icon="⚽", layout="wide")

PROJECT_ROOT = Path(__file__).resolve().parent


@st.cache_resource(show_spinner="Loading data and models...")
def load_everything(refresh_token: int):
    download_data()
    config = load_wc2026()
    results = load_results(download=False)
    shootouts = load_shootouts()
    group_results, ko_results = split_real_results(results, shootouts, config)
    return config, results, group_results, ko_results


@st.cache_resource(show_spinner="Building predictor...")
def get_predictor(refresh_token: int, squad_strength: float):
    _, results, _, _ = load_everything(refresh_token)
    return MatchPredictor(results=results, squad_adjustment_strength=squad_strength)


@st.cache_resource(show_spinner="Building the simulator (predicting every possible pairing)...")
def get_simulator(refresh_token: int, n_sims: int, squad_strength: float):
    config, _, _, _ = load_everything(refresh_token)
    predictor = get_predictor(refresh_token, squad_strength)
    return TournamentSimulator(predictor, config, n_sims=n_sims)


# ── Session state defaults ──────────────────────────────────────────────────
for key, default in [
    ("refresh_token", 0),
    ("manual_results", []),
    ("injuries", {}),
]:
    if key not in st.session_state:
        st.session_state[key] = default

config, results, group_results, ko_results = load_everything(st.session_state.refresh_token)
WC_TEAMS = sorted(t for g in config["groups"].values() for t in g)
GROUP_OF = {t: g for g, ts in config["groups"].items() for t in ts}
FLAGS = config["flags"]


FINISHED_REFRESH_SECS = 300  # re-query API every 5 minutes


def _merge_api_finished(group_results, ko_results, api_matches, cfg):
    """Add API-fetched finished matches not yet in the CSV-derived lists."""
    group_of = {t: g for g, ts in cfg["groups"].items() for t in ts}
    existing = {frozenset((t1, t2)) for t1, t2, *_ in group_results}
    existing |= {frozenset((t1, t2)) for t1, t2, _ in ko_results}
    new_group = list(group_results)
    new_ko = list(ko_results)
    for m in api_matches:
        t1, t2 = m["home"], m["away"]
        key = frozenset((t1, t2))
        if key in existing:
            continue
        s1, s2 = m["score_home"], m["score_away"]
        g1, g2 = group_of.get(t1), group_of.get(t2)
        if g1 is not None and g1 == g2:
            new_group.append((t1, t2, s1, s2))
            existing.add(key)
        else:
            winner = t1 if s1 > s2 else (t2 if s2 > s1 else None)
            if winner:
                new_ko.append((t1, t2, winner))
                existing.add(key)
    return new_group, new_ko


def flag_url(team: str, width: int = 40) -> str:
    code = FLAGS.get(team)
    return f"https://flagcdn.com/w{width}/{code}.png" if code else ""


FLAG_COL = st.column_config.ImageColumn("", width=40)

# ── Sidebar ─────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("⚽ WC 2026 Predictor")
    st.caption(f"Results data through **{results['date'].max().date()}**")

    if st.button("🔄 Refresh latest results", width="stretch"):
        download_data(force=True)
        st.session_state.refresh_token += 1
        st.cache_resource.clear()
        st.rerun()
    st.caption("Pulls the newest match results from GitHub. Retrain with "
               "`python -m src.train` every few days for best accuracy.")

    st.divider()
    st.markdown("#### Squad quality adjustment")
    squad_strength = st.slider(
        "Adjustment strength", 0.0, 0.50, 0.18, 0.02,
        help="How much squad quality (market value, FIFA rank, league index, "
             "coach record, caps) nudges the model's raw probabilities. "
             "0 = model-only. 0.18 ≈ 6 pp shift for a 2-sigma quality gap.")

    report_path = PROJECT_ROOT / "reports" / "backtest.md"
    if report_path.exists():
        with st.expander("📊 Model accuracy (backtest)"):
            st.markdown(report_path.read_text(encoding="utf-8"))

predictor = get_predictor(st.session_state.refresh_token, squad_strength)

# ── Pull finished matches from API and merge into CSV results (5-min TTL) ───
api_key = get_api_key()
if api_key:
    _now = time.time()
    if _now - st.session_state.get("finished_fetch_time", 0) > FINISHED_REFRESH_SECS:
        st.session_state.finished_matches_api = fetch_finished_matches(api_key)
        st.session_state.finished_fetch_time = _now
    group_results, ko_results = _merge_api_finished(
        group_results, ko_results,
        st.session_state.get("finished_matches_api", []),
        config,
    )

tab_match, tab_sim, tab_live_game, tab_live = st.tabs(
    ["🎯 Match Predictor", "🏆 Tournament Simulator", "🔴 Live", "📡 Live Tracker"])

# ─────────────────────────────────────────── Match Predictor tab ────────────
with tab_match:
    col1, col2 = st.columns(2)
    home = col1.selectbox("Team 1", WC_TEAMS, index=WC_TEAMS.index("Argentina"))
    away = col2.selectbox("Team 2", WC_TEAMS, index=WC_TEAMS.index("France"))

    if home == away:
        st.info("Pick two different teams.")
    else:
        hosts = set(config["hosts"])
        if (home in hosts) != (away in hosts):
            if away in hosts:
                home, away = away, home
            neutral = False
            st.caption(f"🏟️ {home} are tournament hosts — treated as playing at home.")
        else:
            neutral = True

        injuries = st.session_state.injuries
        pred = predictor.predict(home, away, neutral=neutral, injuries=injuries)

        # ── Flag banner ───────────────────────────────────────────────────
        st.markdown(
            f'<div style="display:flex;justify-content:center;align-items:center;'
            f'gap:18px;margin:6px 0 14px 0;">'
            f'<img src="{flag_url(home, 80)}" width="64" '
            f'style="border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.3);">'
            f'<span style="font-size:1.7rem;font-weight:700;">{home} &nbsp;vs&nbsp; {away}</span>'
            f'<img src="{flag_url(away, 80)}" width="64" '
            f'style="border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.3);">'
            f'</div>', unsafe_allow_html=True)

        # ── Win probabilities ─────────────────────────────────────────────
        m1, m2, m3, m4 = st.columns(4)
        m1.metric(f"{home} win", f"{pred['p_home']:.1%}")
        m2.metric("Draw", f"{pred['p_draw']:.1%}")
        m3.metric(f"{away} win", f"{pred['p_away']:.1%}")
        m4.metric("Expected goals", f"{pred['lambda_home']:.2f} - {pred['lambda_away']:.2f}")

        bar = go.Figure(go.Bar(
            x=[pred["p_home"], pred["p_draw"], pred["p_away"]],
            y=[f"{home} win", "Draw", f"{away} win"],
            orientation="h", marker_color=["#2563eb", "#9ca3af", "#dc2626"],
            text=[f"{p:.1%}" for p in (pred["p_home"], pred["p_draw"], pred["p_away"])],
            textposition="auto"))
        bar.update_layout(height=220, margin=dict(l=0, r=0, t=10, b=10),
                          xaxis_tickformat=".0%", showlegend=False)
        st.plotly_chart(bar, width="stretch")

        if squad_strength > 0:
            st.caption("_Probabilities adjusted for squad quality + active injury overrides._")

        # ── Squad comparison card ────────────────────────────────────────
        with st.expander("🧑‍🤝‍🧑 Squad comparison", expanded=True):
            labels = ["Squad value (€M)", "FIFA ranking", "Top-5 league players",
                      "Avg. intl. caps", "Coach win rate"]
            h_vals = [pred.get("squad_value_home"), pred.get("fifa_rank_home"),
                      pred.get("league_idx_home"), pred.get("avg_caps_home"),
                      pred.get("coach_wr_home")]
            a_vals = [pred.get("squad_value_away"), pred.get("fifa_rank_away"),
                      pred.get("league_idx_away"), pred.get("avg_caps_away"),
                      pred.get("coach_wr_away")]

            def _fmt(label, val):
                if val is None:
                    return "—"
                if label == "FIFA ranking":
                    return f"#{int(val)}"
                if label in ("Top-5 league players", "Coach win rate"):
                    return f"{val:.0%}"
                if label == "Squad value (€M)":
                    return f"€{int(val):,}M"
                return str(val)

            def _delta_color(label, h, a):
                if h is None or a is None:
                    return None, None
                home_better = (h < a) if label == "FIFA ranking" else (h > a)
                return ("#16a34a" if home_better else "#dc2626",
                        "#dc2626" if home_better else "#16a34a")

            inj_h = injuries.get(home, 0)
            inj_a = injuries.get(away, 0)
            inj_note = []
            if inj_h:
                inj_note.append(f"{home}: {inj_h} key player(s) out")
            if inj_a:
                inj_note.append(f"{away}: {inj_a} key player(s) out")
            if inj_note:
                st.caption("Injuries active — " + " · ".join(inj_note))

            sc1, sc2, sc3 = st.columns([2, 2, 2])
            sc1.markdown(f"**{home}**")
            sc2.markdown("**Metric**")
            sc3.markdown(f"**{away}**")
            for label, hv, av in zip(labels, h_vals, a_vals):
                hc, ac = _delta_color(label, hv, av)
                sc1.markdown(
                    f'<span style="color:{hc or "#111"};font-weight:600">{_fmt(label, hv)}</span>',
                    unsafe_allow_html=True)
                sc2.markdown(f"<span style='color:#6b7280'>{label}</span>",
                             unsafe_allow_html=True)
                sc3.markdown(
                    f'<span style="color:{ac or "#111"};font-weight:600">{_fmt(label, av)}</span>',
                    unsafe_allow_html=True)

        # ── Scoreline heatmap + top scores ───────────────────────────────
        c1, c2 = st.columns([3, 2])
        with c1:
            show = 7
            mat = pred["score_matrix"][:show, :show]
            heat = px.imshow(mat, x=list(range(show)), y=list(range(show)),
                             labels=dict(x=f"{away} goals", y=f"{home} goals", color="prob"),
                             color_continuous_scale="Blues", text_auto=".1%", aspect="auto")
            heat.update_layout(title="Scoreline probabilities", height=420,
                               margin=dict(l=0, r=0, t=40, b=0))
            st.plotly_chart(heat, width="stretch")
        with c2:
            st.markdown("**Most likely scorelines**")
            for hs, as_, p in pred["top_scores"]:
                st.markdown(f"`{home} {hs} - {as_} {away}` — **{p:.1%}**")
            st.markdown("**Elo ratings**")
            st.markdown(f"{home}: **{pred['elo_home']:.0f}** · {away}: **{pred['elo_away']:.0f}**")

# ─────────────────────────────────────────── Tournament Simulator tab ────────
with tab_sim:
    left, right = st.columns([1, 3])
    with left:
        n_sims = st.select_slider("Simulations", options=[2000, 5000, 10000, 20000], value=10000)
        use_live = st.toggle("Lock in real results", value=True,
                             help="Played matches (plus manual entries) are fixed; "
                                  "only the remaining tournament is simulated.")
        run = st.button("▶ Run simulation", type="primary", width="stretch")

    if run:
        sim = get_simulator(st.session_state.refresh_token, n_sims, squad_strength)
        locked = (group_results + st.session_state.manual_results) if use_live else []
        kos = ko_results if use_live else []
        with st.spinner(f"Simulating the tournament {n_sims:,} times..."):
            st.session_state.sim_out = sim.run(locked_group=locked, ko_winners=kos)
            st.session_state.sim_locked = len(locked)

    out = st.session_state.get("sim_out")
    if out is None:
        st.info("Press **Run simulation** to estimate every team's chances.")
    else:
        summary = out["summary"]
        with right:
            top = summary.head(16).iloc[::-1]
            fig = go.Figure(go.Bar(x=top["P(Champion)"], y=top["team"], orientation="h",
                                   marker_color="#16a34a",
                                   text=[f"{p:.1%}" for p in top["P(Champion)"]],
                                   textposition="auto"))
            fig.update_layout(title=f"Championship odds ({out['n_sims']:,} sims, "
                                    f"{st.session_state.get('sim_locked', 0)} real results locked)",
                              height=480, xaxis_tickformat=".0%",
                              margin=dict(l=0, r=0, t=40, b=0))
            st.plotly_chart(fig, width="stretch")

        st.markdown("#### Probability of reaching each stage")
        pct_cols = [c for c in summary.columns if c != "team"]
        table = summary.copy()
        table.insert(0, "flag", table["team"].map(flag_url))
        st.dataframe(table.style.format({c: "{:.1%}" for c in pct_cols})
                     .background_gradient(subset=pct_cols, cmap="Greens", vmin=0, vmax=1),
                     width="stretch", height=420, hide_index=True,
                     column_config={"flag": FLAG_COL})

        st.markdown("#### Group finishing positions")
        g = st.selectbox("Group", list(config["groups"]))
        rp = out["rank_probs"][g].reset_index(names="team")
        rp.insert(0, "flag", rp["team"].map(flag_url))
        st.dataframe(rp.style.format({c: "{:.1%}" for c in rp.columns if c.startswith("P(")})
                     .background_gradient(subset=[c for c in rp.columns if c.startswith("P(")],
                                          cmap="Blues", vmin=0, vmax=1),
                     width="stretch", hide_index=True, column_config={"flag": FLAG_COL})

# ─────────────────────────────────────────── Live tab ───────────────────────
with tab_live_game:
    LIVE_REFRESH_SECS = 30

    if not api_key:
        st.warning("**API key not configured.** To enable live scores:", icon="🔑")
        st.markdown(
            "1. Sign up free at [football-data.org](https://www.football-data.org/)\n"
            "2. Copy `.streamlit/secrets.toml.example` → `.streamlit/secrets.toml`\n"
            "3. Paste your key and restart the app.")
    else:
        @st.fragment(run_every=LIVE_REFRESH_SECS)
        def _live_feed():
            matches, err = fetch_live_matches(api_key)
            st.session_state.live_matches = matches

            col_hdr, col_btn = st.columns([5, 1])
            with col_hdr:
                st.caption(f"Auto-refreshes every {LIVE_REFRESH_SECS}s")
            with col_btn:
                if st.button("🔄 Refresh now", key="live_refresh_btn"):
                    st.rerun(scope="fragment")

            if err and not matches:
                st.warning(f"API: {err}", icon="⚠️")

            if matches:
                st.markdown(f"### {len(matches)} match{'es' if len(matches) > 1 else ''} in progress")
                for match in matches:
                    home_t = match["home"]
                    away_t = match["away"]
                    gh = match["score_home"]
                    ga = match["score_away"]
                    minute = match["minute"]
                    status = match["status"]
                    match_key = f"{home_t}v{away_t}"

                    if status == "PAUSED":
                        min_label = "HT"
                        display_min = 45
                    elif status == "EXTRA_TIME":
                        min_label = f"{minute}' (ET)"
                        display_min = minute
                    elif status == "PENALTY_SHOOTOUT":
                        min_label = "Pens"
                        display_min = 120
                    else:
                        min_label = f"{minute}'"
                        display_min = minute

                    pm_key = f"prematch_{match_key}"
                    if pm_key not in st.session_state:
                        try:
                            pm = predictor.predict(home_t, away_t, neutral=True,
                                                   injuries=st.session_state.injuries)
                            st.session_state[pm_key] = pm
                        except Exception:
                            st.session_state[pm_key] = None
                    pm = st.session_state[pm_key]

                    with st.container(border=True):
                        st.markdown(
                            f'<div style="display:flex;justify-content:center;align-items:center;'
                            f'gap:14px;margin:4px 0 10px 0;">'
                            f'<img src="{flag_url(home_t, 80)}" width="48" '
                            f'style="border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.25);">'
                            f'<span style="font-size:2rem;font-weight:800;">{gh}</span>'
                            f'<span style="font-size:1.1rem;color:#6b7280;padding:0 4px;">–</span>'
                            f'<span style="font-size:2rem;font-weight:800;">{ga}</span>'
                            f'<img src="{flag_url(away_t, 80)}" width="48" '
                            f'style="border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.25);">'
                            f'</div>'
                            f'<div style="text-align:center;font-size:0.95rem;color:#374151;margin-bottom:8px;">'
                            f'<b>{home_t}</b> &nbsp;vs&nbsp; <b>{away_t}</b> &nbsp;'
                            f'<span style="background:#ef4444;color:#fff;border-radius:4px;'
                            f'padding:1px 7px;font-size:0.8rem;">● {min_label}</span>'
                            f'</div>',
                            unsafe_allow_html=True)

                        if pm is None:
                            st.warning(f"Could not generate pre-match prediction for {home_t} vs {away_t}.")
                            continue

                        extra = 5 if display_min >= 90 else (3 if display_min >= 45 else 0)
                        live_p = ingame_probs(
                            pm["lambda_home"], pm["lambda_away"],
                            gh, ga, display_min, extra_min=extra)

                        m1, m2, m3 = st.columns(3)
                        m1.metric(f"{home_t} win", f"{live_p['p_home']:.1%}")
                        m2.metric("Draw", f"{live_p['p_draw']:.1%}")
                        m3.metric(f"{away_t} win", f"{live_p['p_away']:.1%}")

                        bar = go.Figure(go.Bar(
                            x=[live_p["p_home"], live_p["p_draw"], live_p["p_away"]],
                            y=[f"{home_t} win", "Draw", f"{away_t} win"],
                            orientation="h",
                            marker_color=["#2563eb", "#9ca3af", "#dc2626"],
                            text=[f"{p:.1%}" for p in
                                  (live_p["p_home"], live_p["p_draw"], live_p["p_away"])],
                            textposition="auto"))
                        bar.update_layout(height=180, margin=dict(l=0, r=0, t=8, b=8),
                                          xaxis_tickformat=".0%", showlegend=False)
                        st.plotly_chart(bar, width="stretch")

                        history = st.session_state.setdefault("wpa_history", {})
                        pts = history.setdefault(match_key, [])
                        if not pts or pts[-1][0] < display_min:
                            pts.append((display_min, live_p["p_home"],
                                        live_p["p_draw"], live_p["p_away"]))

                        if len(pts) >= 2:
                            mins  = [p[0] for p in pts]
                            ph_ts = [p[1] for p in pts]
                            pd_ts = [p[2] for p in pts]
                            pa_ts = [p[3] for p in pts]
                            timeline = go.Figure()
                            timeline.add_trace(go.Scatter(
                                x=mins, y=ph_ts, mode="lines+markers", name=f"{home_t} win",
                                line=dict(color="#2563eb", width=2)))
                            timeline.add_trace(go.Scatter(
                                x=mins, y=pd_ts, mode="lines+markers", name="Draw",
                                line=dict(color="#9ca3af", width=2, dash="dot")))
                            timeline.add_trace(go.Scatter(
                                x=mins, y=pa_ts, mode="lines+markers", name=f"{away_t} win",
                                line=dict(color="#dc2626", width=2)))
                            timeline.update_layout(
                                title="Win probability over time",
                                height=280, xaxis_title="Minute",
                                yaxis_tickformat=".0%", yaxis_range=[0, 1],
                                margin=dict(l=0, r=0, t=36, b=0),
                                legend=dict(orientation="h", yanchor="bottom", y=1.02))
                            st.plotly_chart(timeline, width="stretch")

                        with st.expander("Pre-match prediction", expanded=False):
                            st.caption(
                                f"Pre-match: {home_t} {pm['p_home']:.1%} / "
                                f"Draw {pm['p_draw']:.1%} / {away_t} {pm['p_away']:.1%} · "
                                f"xG {pm['lambda_home']:.2f}–{pm['lambda_away']:.2f} · "
                                f"Elo {pm['elo_home']:.0f} vs {pm['elo_away']:.0f}")
            else:
                st.info("No WC matches currently in progress.")
                today_matches = fetch_todays_matches(api_key)
                if today_matches:
                    st.markdown("#### Today's upcoming matches")
                    for match in today_matches:
                        home_t = match["home"]
                        away_t = match["away"]
                        utc = match["utc_date"][:16].replace("T", " ") + " UTC" if match["utc_date"] else ""
                        with st.container(border=True):
                            st.markdown(
                                f'<div style="display:flex;align-items:center;gap:12px;">'
                                f'<img src="{flag_url(home_t, 40)}" width="32" style="border-radius:3px;">'
                                f'<b>{home_t}</b> vs <b>{away_t}</b>'
                                f'<img src="{flag_url(away_t, 40)}" width="32" style="border-radius:3px;">'
                                f'<span style="color:#6b7280;font-size:0.85rem">{utc}</span>'
                                f'</div>', unsafe_allow_html=True)
                            try:
                                pm = predictor.predict(home_t, away_t, neutral=True,
                                                       injuries=st.session_state.injuries)
                                c1, c2, c3 = st.columns(3)
                                c1.metric(f"{home_t} win", f"{pm['p_home']:.1%}")
                                c2.metric("Draw", f"{pm['p_draw']:.1%}")
                                c3.metric(f"{away_t} win", f"{pm['p_away']:.1%}")
                            except Exception:
                                st.caption("Could not generate prediction for this fixture.")
                else:
                    st.caption("No WC matches scheduled for today either.")

        _live_feed()

# ─────────────────────────────────────────── Live Tracker tab ───────────────
with tab_live:
    _tracker_hdr, _tracker_btn = st.columns([5, 1])
    with _tracker_hdr:
        if api_key and st.session_state.get("finished_fetch_time"):
            _secs = int(time.time() - st.session_state.finished_fetch_time)
            st.caption(f"Auto-syncs from API every {FINISHED_REFRESH_SECS // 60} min · last updated {_secs}s ago")
        else:
            st.caption("No API key — showing CSV data only. Add your key to enable real-time sync.")
    with _tracker_btn:
        if st.button("🔄 Sync now", key="tracker_sync"):
            if api_key:
                st.session_state.finished_matches_api = fetch_finished_matches(api_key)
                st.session_state.finished_fetch_time = time.time()
            st.rerun()
    st.markdown(f"#### Played 2026 World Cup matches ({len(group_results) + len(ko_results)})")
    all_played = group_results + st.session_state.manual_results
    if not all_played and not ko_results:
        st.info("No 2026 World Cup results in the dataset yet — hit refresh in the sidebar.")
    else:
        played_df = pd.DataFrame(all_played, columns=["team1", "team2", "score1", "score2"])
        played_df["group"] = played_df["team1"].map(GROUP_OF)
        played_df["flag1"] = played_df["team1"].map(flag_url)
        played_df["flag2"] = played_df["team2"].map(flag_url)
        st.dataframe(played_df[["group", "flag1", "team1", "score1", "score2", "team2", "flag2"]],
                     width="stretch", hide_index=True,
                     column_config={"flag1": FLAG_COL, "flag2": FLAG_COL})

        st.markdown("#### Current group standings")
        groups_started = sorted({GROUP_OF[t1] for t1, *_ in all_played})
        cols = st.columns(min(3, max(1, len(groups_started))))
        for i, letter in enumerate(groups_started):
            teams = config["groups"][letter]
            ms = [m for m in all_played if GROUP_OF[m[0]] == letter]
            order = standings(teams, ms)
            stats_tbl = {t: [0, 0, 0, 0] for t in teams}
            for t1, t2, s1, s2 in ms:
                for t, gf_, ga_ in ((t1, s1, s2), (t2, s2, s1)):
                    stats_tbl[t][0] += 1
                    stats_tbl[t][1] += 3 if gf_ > ga_ else (1 if gf_ == ga_ else 0)
                    stats_tbl[t][2] += gf_ - ga_
                    stats_tbl[t][3] += gf_
            tbl = pd.DataFrame([[flag_url(t), t, *stats_tbl[t]] for t in order],
                               columns=["flag", "team", "P", "Pts", "GD", "GF"])
            with cols[i % len(cols)]:
                st.markdown(f"**Group {letter}**")
                st.dataframe(tbl, width="stretch", hide_index=True,
                             column_config={"flag": FLAG_COL})

    # ── Manual result entry ──────────────────────────────────────────────
    st.markdown("#### Enter a result manually")
    st.caption("Fallback for when the dataset hasn't updated yet. "
               "Manual results are locked into simulations alongside real ones.")
    with st.form("manual_result", clear_on_submit=True):
        c1, c2, c3, c4, c5 = st.columns([3, 1, 1, 3, 2])
        t1 = c1.selectbox("Team 1", WC_TEAMS, key="m_t1")
        s1 = c2.number_input("Goals", 0, 15, 0, key="m_s1")
        s2 = c3.number_input("Goals ", 0, 15, 0, key="m_s2")
        t2 = c4.selectbox("Team 2", WC_TEAMS, index=1, key="m_t2")
        add = c5.form_submit_button("Add result")
    if add:
        if t1 == t2:
            st.error("Pick two different teams.")
        elif GROUP_OF[t1] != GROUP_OF[t2]:
            st.error("Manual entry supports group-stage matches only "
                     "(both teams must be in the same group).")
        else:
            st.session_state.manual_results.append((t1, t2, int(s1), int(s2)))
            st.rerun()
    if st.session_state.manual_results:
        st.write(f"{len(st.session_state.manual_results)} manual result(s) active.")
        if st.button("Clear manual results"):
            st.session_state.manual_results = []
            st.rerun()

    # ── Injury / suspension overrides ────────────────────────────────────
    st.divider()
    st.markdown("#### Key player absences (injury/suspension overrides)")
    st.caption(
        "Each key player marked out reduces that team's effective squad value by ~€30M "
        "when computing the squad quality adjustment. "
        "Use the sidebar slider to control overall adjustment strength.")

    inj_cols = st.columns(4)
    new_injuries: dict[str, int] = {}
    for idx, team in enumerate(WC_TEAMS):
        current = st.session_state.injuries.get(team, 0)
        val = inj_cols[idx % 4].number_input(
            team, min_value=0, max_value=11, value=current, step=1,
            key=f"inj_{team}")
        if val > 0:
            new_injuries[team] = val

    if st.button("Apply injury overrides", type="primary"):
        st.session_state.injuries = new_injuries
        if new_injuries:
            st.success("Overrides saved: "
                       + ", ".join(f"{t} ({n} out)" for t, n in new_injuries.items()))
        else:
            st.success("All injury overrides cleared.")
        st.rerun()

    if st.session_state.injuries:
        active = st.session_state.injuries
        st.caption("Active: " + " · ".join(f"**{t}** {n} out" for t, n in active.items()))
        if st.button("Clear all overrides"):
            st.session_state.injuries = {}
            st.rerun()
