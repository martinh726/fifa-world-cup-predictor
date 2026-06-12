"""Headless smoke test: runs the Streamlit app script and the simulation flow."""
from streamlit.testing.v1 import AppTest

at = AppTest.from_file("app.py", default_timeout=600)
at.run()
assert not at.exception, f"App raised on initial render: {at.exception}"
print("Initial render OK")
print(f"  tabs: {len(at.tabs)}, buttons: {len(at.button)}, metrics: {len(at.metric)}")
print(f"  match prediction metrics: {[m.value for m in at.metric]}")

# click "Run simulation" (the primary-type button)
sim_btn = next(b for b in at.button if "Run simulation" in b.label)
sim_btn.click()
at.run()
assert not at.exception, f"App raised after simulation: {at.exception}"
dfs = len(at.dataframe)
print(f"Simulation run OK — {dfs} dataframes rendered")
assert dfs >= 2, "expected summary + group tables after simulation"
print("SMOKE TEST PASSED")
