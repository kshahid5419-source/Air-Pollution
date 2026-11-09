from statistics import mean

def build_insights(hourly: dict):
    times = hourly.get("time", [])
    values = hourly.get("us_aqi", [])
    valid = [(t, v) for t, v in zip(times, values) if isinstance(v, (int, float))]
    if not valid:
        return {"summary": "Not enough air-quality data to generate an insight.", "anomaly": False,
                "prediction": None, "confidence": "insufficient data"}
    recent = [v for _, v in valid[-6:]]
    baseline = [v for _, v in valid[-24:-6]]
    recent_avg = mean(recent)
    baseline_avg = mean(baseline) if baseline else recent_avg
    latest = valid[-1][1]
    anomaly = bool(baseline and recent_avg > baseline_avg * 1.35 and recent_avg - baseline_avg >= 15)
    summary = f"Latest available modeled US AQI is {round(latest)}. "
    if anomaly:
        summary += "Recent values are notably above the preceding baseline. Check local conditions and community reports."
    elif recent_avg > 100:
        summary += "Recent values are elevated. Sensitive groups should follow local public-health guidance."
    else:
        summary += "Recent values are relatively stable compared with the preceding available hours."
    return {"summary": summary, "anomaly": anomaly, "recent_average": round(recent_avg, 1),
            "baseline_average": round(baseline_avg, 1), "prediction": round(recent_avg, 1),
            "prediction_label": "simple baseline estimate, not a validated forecast",
            "confidence": "low; based on available model series"}
