from src.services import traffic


def test_parse_legs_minutes_and_delay():
    data = {
        "routes": [
            {
                "legs": [
                    {"summary": {"travelTimeInSeconds": 610, "trafficDelayInSeconds": 120}},
                    {"summary": {"travelTimeInSeconds": 1500, "trafficDelayInSeconds": 0}},
                ]
            }
        ]
    }
    legs = traffic.parse_legs(data)
    assert [(l.minutes, l.traffic_delay_min) for l in legs] == [(10, 2), (25, 0)]


def test_parse_legs_empty():
    assert traffic.parse_legs({}) == []
