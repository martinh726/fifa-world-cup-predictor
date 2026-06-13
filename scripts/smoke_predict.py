"""Quick smoke test for the new squad-enriched predictor."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.predict import MatchPredictor

mp = MatchPredictor()

p = mp.predict("Spain", "Cape Verde", neutral=True)
print(f"Spain vs Cape Verde:")
print(f"  W {p['p_home']:.1%} / D {p['p_draw']:.1%} / L {p['p_away']:.1%}")
print(f"  Squad: E{p['squad_value_home']}M vs E{p['squad_value_away']}M")
print(f"  FIFA: #{p['fifa_rank_home']} vs #{p['fifa_rank_away']}")
print(f"  League idx: {p['league_idx_home']:.0%} vs {p['league_idx_away']:.0%}")

p2 = mp.predict("Argentina", "France", neutral=True)
print(f"\nArgentina vs France:")
print(f"  W {p2['p_home']:.1%} / D {p2['p_draw']:.1%} / L {p2['p_away']:.1%}")

# Injury test: England with 3 key players out vs without
p3 = mp.predict("England", "Germany", neutral=True, injuries={"England": 3})
p4 = mp.predict("England", "Germany", neutral=True)
print(f"\nEngland vs Germany (no injuries): W {p4['p_home']:.1%}")
print(f"England vs Germany (3 England injuries): W {p3['p_home']:.1%}")
assert p3["p_home"] < p4["p_home"], "Injuries should reduce England win prob"
print("Injury override working correctly.")
