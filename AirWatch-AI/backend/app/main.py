from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc
import asyncio
import math
import httpx

from .database import Base, engine, get_db
from .config import settings
from . import models, schemas
from .services.air_quality import fetch_air_quality
from .services.insights import build_insights

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AirWatch AI API",
    version="2.0.0",
    description="Community air intelligence platform grounded in environmental rights and climate justice.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_LOCATIONS = [
    {"id": "central", "name": "Lahore Central", "latitude": 31.5204, "longitude": 74.3587},
    {"id": "gulberg", "name": "Gulberg", "latitude": 31.5100, "longitude": 74.3440},
    {"id": "model-town", "name": "Model Town", "latitude": 31.4830, "longitude": 74.3260},
    {"id": "dha", "name": "DHA", "latitude": 31.4690, "longitude": 74.4100},
    {"id": "shahdara", "name": "Shahdara", "latitude": 31.6170, "longitude": 74.2860},
    {"id": "badami-bagh", "name": "Badami Bagh", "latitude": 31.5890, "longitude": 74.3420},
]

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"

LEGAL_FRAMEWORK = {
    "core_instruments": [
        {
            "name": "UNGA Resolution 76/300 (2022)",
            "title": "Right to a Clean, Healthy and Sustainable Environment",
            "summary": "Recognises that a clean, healthy and sustainable environment is a universal human right. Air pollution is a direct violation of this right for hundreds of millions of people.",
            "relevance": "Provides the strongest global normative foundation for treating clean air as a justiciable right.",
        },
        {
            "name": "Paris Agreement (2015)",
            "title": "Climate Action & Equity",
            "summary": "Commits parties to limit warming and to pursue efforts to 1.5°C, while recognising equity and common but differentiated responsibilities (CBDR-RC).",
            "relevance": "Air pollution co-benefits of climate mitigation are explicitly recognised; fossil-fuel combustion drives both climate change and lethal particulate pollution.",
        },
        {
            "name": "UNFCCC",
            "title": "United Nations Framework Convention on Climate Change",
            "summary": "The parent treaty establishing the principle of common but differentiated responsibilities and respective capabilities.",
            "relevance": "Frames why historically high-emitting nations and actors bear greater responsibility for both climate and air-quality harm.",
        },
        {
            "name": "Aarhus Convention principles",
            "title": "Access to Information, Public Participation & Justice",
            "summary": "Although regional, its three pillars (information, participation, justice) are widely cited as global best practice for environmental democracy.",
            "relevance": "Community reporting and transparent air-quality data are practical expressions of the right to environmental information.",
        },
        {
            "name": "Polluter Pays Principle",
            "title": "Rio Declaration Principle 16",
            "summary": "The polluter should bear the cost of pollution, with due regard to the public interest and without distorting international trade.",
            "relevance": "Supports accountability for industrial, transport and open-burning sources of local air pollution.",
        },
    ],
    "climate_justice_pillars": [
        {
            "title": "Distributive Justice",
            "text": "The poorest communities and Global South cities often breathe the most polluted air while having contributed least to the emissions causing the problem.",
        },
        {
            "title": "Procedural Justice",
            "text": "Affected people must have meaningful access to information, decision-making processes, and remedies — not merely be subjects of monitoring.",
        },
        {
            "title": "Intergenerational Justice",
            "text": "Children and future generations inherit both the climate system and the cumulative health burden of chronic exposure to polluted air.",
        },
        {
            "title": "Recognition Justice",
            "text": "Informal workers, outdoor labourers, women cooking with solid fuels, and residents of informal settlements are systematically under-counted in official data.",
        },
    ],
    "key_facts": [
        "Air pollution is responsible for an estimated 7 million premature deaths every year (WHO).",
        "More than 90% of the world’s population breathes air that exceeds WHO guideline limits.",
        "The health burden falls disproportionately on low- and middle-income countries.",
        "Fine particulate matter (PM2.5) is both a major climate forcer and the leading environmental risk factor for premature death.",
        "The right to a clean environment was recognised by the UN General Assembly in 2022 as a human right.",
    ],
}


def nearby_points(latitude: float, longitude: float, label: str):
    d_lat = 0.065
    d_lon = 0.065 / max(0.2, math.cos(math.radians(latitude)))
    offsets = [
        ("centre", label, 0, 0),
        ("north", "North of centre", d_lat, 0),
        ("south", "South of centre", -d_lat, 0),
        ("east", "East of centre", 0, d_lon),
        ("west", "West of centre", 0, -d_lon),
        ("northeast", "North-east of centre", d_lat, d_lon),
    ]
    pts = []
    for pid, name, dy, dx in offsets:
        lat = max(-90, min(90, latitude + dy))
        lon = ((longitude + dx + 180) % 360) - 180
        pts.append({"id": pid, "name": name, "latitude": round(lat, 4), "longitude": round(lon, 4)})
    return pts


@app.get("/api/geocode")
async def geocode(q: str = Query(..., min_length=2, max_length=80)):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                GEOCODE_URL,
                params={"name": q, "count": 6, "language": "en", "format": "json"},
            )
            r.raise_for_status()
            results = r.json().get("results") or []
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding provider unavailable: {exc}")
    return [
        {
            "id": f"geo-{x.get('id')}",
            "name": ", ".join(p for p in [x.get("name"), x.get("admin1"), x.get("country")] if p),
            "latitude": x["latitude"],
            "longitude": x["longitude"],
        }
        for x in results
    ]


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AirWatch AI", "version": "2.0.0"}


@app.get("/api/locations")
def locations():
    return DEMO_LOCATIONS


@app.get("/api/air-quality")
async def air_quality(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    past_days: int = Query(2, ge=0, le=5),
):
    return await fetch_air_quality(latitude, longitude, past_days)


@app.get("/api/hotspots")
async def pollution_hotspots(
    latitude: float | None = Query(None, ge=-90, le=90),
    longitude: float | None = Query(None, ge=-180, le=180),
    name: str = Query("Selected area", max_length=80),
):
    places = DEMO_LOCATIONS if latitude is None or longitude is None else nearby_points(latitude, longitude, name)

    async def read_location(place):
        try:
            data = await fetch_air_quality(place["latitude"], place["longitude"], 1)
            current = data.get("current") or {}
            return {
                **place,
                "aqi": current.get("us_aqi"),
                "pm2_5": current.get("pm2_5"),
                "pm10": current.get("pm10"),
                "status": "ok" if current.get("us_aqi") is not None else "no_data",
            }
        except HTTPException as exc:
            return {
                **place,
                "aqi": None,
                "pm2_5": None,
                "pm10": None,
                "status": "unavailable",
                "error": exc.detail,
            }

    results = await asyncio.gather(*(read_location(p) for p in places))
    ranked = sorted(
        [r for r in results if isinstance(r.get("aqi"), (int, float))],
        key=lambda r: r["aqi"],
        reverse=True,
    )
    return {
        "locations": results,
        "highest": ranked[0] if ranked else None,
        "lowest": ranked[-1] if ranked else None,
        "area": name if latitude is not None else "Lahore (demo)",
        "note": "Comparisons use Open-Meteo/CAMS modeled grid estimates, not physical sensor readings.",
    }


@app.post("/api/reports", response_model=schemas.ReportOut, status_code=201)
def create_report(payload: schemas.ReportCreate, db: Session = Depends(get_db)):
    report = models.CommunityReport(**payload.model_dump(), status="pending")
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@app.get("/api/reports", response_model=list[schemas.ReportOut])
def list_reports(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.CommunityReport)
    if status:
        if status not in {"pending", "verified", "rejected"}:
            raise HTTPException(status_code=400, detail="Invalid status")
        query = query.filter(models.CommunityReport.status == status)
    return query.order_by(desc(models.CommunityReport.created_at)).limit(200).all()


@app.get("/api/community-insights")
def community_insights(db: Session = Depends(get_db)):
    reports = (
        db.query(models.CommunityReport)
        .order_by(desc(models.CommunityReport.created_at))
        .limit(500)
        .all()
    )
    counts = {}
    for report in reports:
        if report.status != "rejected":
            counts[report.category] = counts.get(report.category, 0) + 1
    suggestions = {
        "smoke": "Record time and area; persistent smoke can be raised with local environmental authorities under the polluter-pays principle.",
        "dust": "Note construction or road activity; dust-control measures are often required by local environmental regulation.",
        "burning": "Avoid approaching the source; open burning frequently violates local air-quality and waste rules.",
        "industrial": "Document location and time from a safe public place; request inspection citing applicable emission standards.",
        "other": "Collect clear, non-identifying observations so moderators can classify the issue and link it to relevant rights frameworks.",
    }
    most_common = max(counts, key=counts.get) if counts else None
    return {
        "total_reports": len(reports),
        "category_counts": counts,
        "most_reported": most_common,
        "suggested_action": suggestions.get(
            most_common,
            "Encourage residents to submit specific, factual observations that can support accountability.",
        ),
        "pending_reports": sum(r.status == "pending" for r in reports),
        "verified_reports": sum(r.status == "verified" for r in reports),
        "note": "Community submissions are observations, not verified pollution measurements.",
    }


@app.patch("/api/reports/{report_id}/verify", response_model=schemas.ReportOut)
def verify_report(
    report_id: int,
    decision: str = Query(..., pattern="^(verified|rejected)$"),
    db: Session = Depends(get_db),
):
    # DEMO ONLY: add moderator authentication/authorization before real deployment.
    report = db.query(models.CommunityReport).filter(models.CommunityReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = decision
    db.commit()
    db.refresh(report)
    return report


@app.get("/api/insights")
async def insights(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    data = await fetch_air_quality(latitude, longitude, 2)
    return build_insights(data.get("hourly", {}))


@app.get("/api/rights")
def environmental_rights():
    """International environmental law and climate justice framing."""
    return LEGAL_FRAMEWORK
