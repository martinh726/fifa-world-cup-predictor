"""refresh() must build the new AppState off to the side and swap it in with
a single assignment, carrying over last_sim_result, rather than mutating the
live state field-by-field (which could let a request observe a half-updated
predictor/results combination)."""
from backend import deps


def test_refresh_swaps_state_and_preserves_last_sim_result(monkeypatch):
    original = deps.AppState(last_sim_result={"summary": "original"})
    deps._state = original

    built_states = []

    def fake_build_state(squad_strength, force_download):
        s = deps.AppState()
        built_states.append(s)
        return s

    monkeypatch.setattr(deps, "_build_state", fake_build_state)

    deps.refresh(squad_strength=0.2)

    new_state = deps.get_state()
    assert new_state is not original
    assert new_state is built_states[0]
    assert new_state.last_sim_result == {"summary": "original"}


def test_set_last_sim_result_updates_current_state():
    deps._state = deps.AppState()
    deps.set_last_sim_result({"foo": "bar"})
    assert deps.get_state().last_sim_result == {"foo": "bar"}


def test_predictor_for_returns_singleton_within_tolerance():
    class FakePredictor:
        squad_adjustment_strength = 0.18

        def with_strength(self, strength):
            raise AssertionError("should not clone within tolerance")

    state = deps.AppState(predictor=FakePredictor())
    result = deps.predictor_for(state, 0.182)
    assert result is state.predictor


def test_predictor_for_clones_outside_tolerance():
    class FakePredictor:
        squad_adjustment_strength = 0.18

        def with_strength(self, strength):
            return f"clone-{strength}"

    state = deps.AppState(predictor=FakePredictor())
    result = deps.predictor_for(state, 0.4)
    assert result == "clone-0.4"
