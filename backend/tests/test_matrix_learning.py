"""Drive-time learning: specific segment beats city profile; outliers ignored."""

from src.services import matrix_learning as ml


def _model_with(samples):
    model = ml.LearnedModel()
    for (a, b, bucket, ratio) in samples:
        ca, cb = ml._cell(*a), ml._cell(*b)
        model.pair_bucket[(ca, cb, bucket)].add(ratio, 1.0)
        model.pair_any[(ca, cb)].add(ratio, 1.0)
        model.profile_bucket[bucket].add(ratio, 1.0)
        model.overall.add(ratio, 1.0)
    return model


A, B, C = (32.0700, 34.7800), (32.0900, 34.8000), (32.1500, 34.9000)


def test_hour_buckets_match_planner():
    assert ml.hour_to_bucket(8) == "morning"
    assert ml.hour_to_bucket(9) == "morning"
    assert ml.hour_to_bucket(12) == "midday"
    assert ml.hour_to_bucket(15) == "afternoon"


def test_segment_factor_learned_and_clamped():
    model = _model_with([(A, B, "morning", 1.5), (A, B, "morning", 1.5)])
    assert abs(ml.factor_for(model, A, B, "morning") - 1.5) < 1e-6
    heavy = _model_with([(A, B, "morning", 3.0)] * 3)
    assert ml.factor_for(heavy, A, B, "morning") == ml.FACTOR_MAX


def test_unknown_segment_uses_time_of_day_profile():
    model = _model_with([(A, B, "afternoon", 1.3)] * 4)
    # A→C never driven, but afternoons are 30% slower city-wide
    assert abs(ml.factor_for(model, A, C, "afternoon") - 1.3) < 1e-6
    assert ml.factor_for(model, A, C, "morning") == ml.factor_for(model, A, C, "midday")


def test_no_data_is_neutral():
    assert ml.factor_for(ml.LearnedModel(), A, B, "morning") == 1.0
