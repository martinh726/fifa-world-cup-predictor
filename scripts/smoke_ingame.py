"""Smoke test for ingame_probs."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.predict import ingame_probs

# 65 min, leading 1-0 — strong team should be heavily favoured
p = ingame_probs(2.1, 0.4, 1, 0, 65)
print(f"65min 1-0: home {p['p_home']:.1%} / draw {p['p_draw']:.1%} / away {p['p_away']:.1%}")
assert p["p_home"] > 0.85, f"Expected home heavily favoured, got {p['p_home']:.1%}"

# 75 min, 0-1 down (weaker team leading) — stronger team still has chance
p2 = ingame_probs(2.1, 0.4, 0, 1, 75)
print(f"75min 0-1: home {p2['p_home']:.1%} / draw {p2['p_draw']:.1%} / away {p2['p_away']:.1%}")
assert p2["p_home"] > 0.02, "Stronger team should have non-trivial chance trailing at 75"
assert p2["p_away"] > 0.60, "Trailing team leading 1-0 at 75 min should be heavy favourite"

# 90+5, 0-0 — draw very likely
p3 = ingame_probs(1.2, 1.0, 0, 0, 90, extra_min=5)
print(f"90+5 0-0: home {p3['p_home']:.1%} / draw {p3['p_draw']:.1%} / away {p3['p_away']:.1%}")
assert p3["p_draw"] > 0.70, "Draw should dominate at 90+5 with 0-0"

# Probabilities must sum to 1
for label, px in [("65min", p), ("75min", p2), ("90+5", p3)]:
    total = px["p_home"] + px["p_draw"] + px["p_away"]
    assert abs(total - 1.0) < 0.001, f"{label} probs sum to {total:.4f}"

print("All assertions passed.")
