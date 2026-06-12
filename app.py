"""2026 FIFA World Cup predictor — Streamlit dashboard."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.data_loader import download_data, load_results, load_shootouts, load_wc2026
from src.predict import MatchPredictor
from src.simulate import TournamentSimulator
from src.tournament import split_real_results, standings

st.set_page_config(page_title="2026 World Cup Predictor", page_icon="⚽", layout="wide")

PROJECT_ROOT = Path(__file__).resolve().parent


@st.cache_resource(show_spinner="Loading data and models...")
def load_everything(refresh_token: int):
    download_data()  # no-op if files already exist
    config = load_wc2026()
    results = load_results(download=False)
    predictor = MatchPredictor(results=results)
    shootouts = load_shootouts()
    group_results, ko_results = split_real_results(results, shootouts, config)
    return config, results, predictor, group_results, ko_results


@st.cache_resource(show_spinner="Building the simulator (predicting every possible pairing)...")
def get_simulator(refresh_token: int, n_sims: int):
    config, _, predictor, _, _ = load_everything(refresh_token)
    return TournamentSimulator(predictor, config, n_sims=n_sims)


if "refresh_token" not in st.session_state:
    st.session_state.refresh_token = 0
if "manual_results" not in st.session_state:
    st.session_state.manual_results = []

config, results, predictor, group_results, ko_results = load_everything(st.session_state.refresh_token)
WC_TEAMS = sorted(t for g in config["groups"].values() for t in g)
GROUP_OF = {t: g for g, ts in config["groups"].items() for t in ts}
FLAGS = config["flags"]


def flag_url(team: str, width: int = 40) -> str:
    code = FLAGS.get(team)
    return f"https://flagcdn.com/w{width}/{code}.png" if code else ""


FLAG_COL = st.column_config.ImageColumn("", width=40)

with st.sidebar:
    st.title("⚽ WC 2026 Predictor")
    st.caption(f"Results data through **{results['date'].max().date()}** · "
               f"model trained through **{predictor.trained_through}**")
    if st.button("🔄 Refresh latest results", width="stretch"):
        download_data(force=True)
        st.session_state.refresh_token += 1
        st.cache_resource.clear()
        st.rerun()
    st.caption("Pulls the newest match results from GitHub. Retrain with "
               "`python -m src.train` every few days for best accuracy.")
    report_path = PROJECT_ROOT / "reports" / "backtest.md"
    if report_path.exists():
        with st.expander("📊 Model accuracy (backtest)"):
            st.markdown(report_path.read_text(encoding="utf-8"))

tab_match, tab_sim, tab_live = st.tabs(["🎯 Match Predictor", "🏆 Tournament Simulator", "📡 Live Tracker"])

# ---------------------------------------------------------------- match tab
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

        pred = predictor.predict(home, away, neutral=neutral)

        st.markdown(
            f'<div style="display:flex;justify-content:center;align-items:center;'
            f'gap:18px;margin:6px 0 14px 0;">'
            f'<img src="{flag_url(home, 80)}" width="64" '
            f'style="border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.3);">'
            f'<span style="font-size:1.7rem;font-weight:700;">{home} &nbsp;vs&nbsp; {away}</span>'
            f'<img src="{flag_url(away, 80)}" width="64" '
            f'style="border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.3);">'
            f'</div>', unsafe_allow_html=True)

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

        c1, c2 = st.columns([3, 2])
        with c1:
            show = 7  # display 0..6 goals
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

# ------------------------------------------------------------- simulator tab
with tab_sim:
    left, right = st.columns([1, 3])
    with left:
        n_sims = st.select_slider("Simulations", options=[2000, 5000, 10000, 20000], value=10000)
        use_live = st.toggle("Lock in real results", value=True,
                             help="Played matches (plus any you entered manually) are fixed; "
                                  "only the remaining tournament is simulated.")
        run = st.button("▶ Run simulation", type="primary", width="stretch")

    if run:
        sim = get_simulator(st.session_state.refresh_token, n_sims)
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

# ------------------------------------------------------------------ live tab
with tab_live:
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
            stats = {t: [0, 0, 0, 0] for t in teams}  # P, pts, gd, gf
            for t1, t2, s1, s2 in ms:
                for t, gf_, ga_ in ((t1, s1, s2), (t2, s2, s1)):
                    stats[t][0] += 1
                    stats[t][1] += 3 if gf_ > ga_ else (1 if gf_ == ga_ else 0)
                    stats[t][2] += gf_ - ga_
                    stats[t][3] += gf_
            tbl = pd.DataFrame([[flag_url(t), t, *stats[t]] for t in order],
                               columns=["flag", "team", "P", "Pts", "GD", "GF"])
            with cols[i % len(cols)]:
                st.markdown(f"**Group {letter}**")
                st.dataframe(tbl, width="stretch", hide_index=True,
                             column_config={"flag": FLAG_COL})

    st.markdown("#### Enter a result manually")
    st.caption("Fallback for when the dataset hasn't been updated yet. "
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
            st.error("Manual entry currently supports group-stage matches only "
                     "(the two teams must be in the same group).")
        else:
            st.session_state.manual_results.append((t1, t2, int(s1), int(s2)))
            st.rerun()
    if st.session_state.manual_results:
        st.write(f"{len(st.session_state.manual_results)} manual result(s) active.")
        if st.button("Clear manual results"):
            st.session_state.manual_results = []
            st.rerun()
