# AirWatch AI 🌍

**Clean air is a human right.**

A community air-intelligence platform that connects modeled air-quality data, resident observations, and international environmental law — built for transparency, accountability, and climate justice.

> Hackathon-ready MVP with a strong rights-based narrative, modern UI, and production-oriented structure.

---

## Why this exists

Air pollution kills an estimated **7 million people** every year. More than 90% of the world breathes air that exceeds WHO guidelines. The burden falls hardest on communities that contributed least to the problem.

In 2022 the UN General Assembly recognised the **right to a clean, healthy and sustainable environment** (Resolution 76/300). AirWatch AI turns that principle into a practical tool: local data + community voice + clear legal framing.

---

## Features

- **Interactive map** with worldwide city search, browser geolocation, and global presets
- **Open-Meteo / CAMS** modeled air quality (US AQI, PM2.5, PM10)
- **Hotspot comparison** around any location
- **Community reporting** with pending / verified / rejected workflow
- **Statistical insights** (baseline vs recent anomaly detection)
- **International environmental law & climate justice** section:
  - UNGA 76/300 (right to a clean environment)
  - Paris Agreement & CBDR
  - UNFCCC
  - Aarhus principles
  - Polluter Pays
  - Four pillars of climate justice (distributive, procedural, intergenerational, recognition)
- **Responsive, presentation-ready UI**

**Data honesty:** Open-Meteo values are model-based grid estimates, not street-level sensors. Community reports are observations until human-verified.

---

## Quick start (local)

### Requirements
- Python 3.10+
- Node.js 18+
- Git

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
# optional: copy .env.example to .env
uvicorn app.main:app --reload
```
API: http://127.0.0.1:8000 · Docs: http://127.0.0.1:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

### Docker (API + Postgres)
```bash
docker compose up --build
```

---

## Production deployment notes

| Issue | Fix applied |
|-------|-------------|
| Frontend pointed only at localhost | `VITE_API_URL` env var |
| CORS limited to local | Configurable multi-origin CORS |
| SQLite unsuitable for many hosts | Postgres support via `DATABASE_URL` |
| No container story | Dockerfile + docker-compose |
| Missing production hygiene | `.gitignore`, `.env.example`, health endpoint |

**Recommended platforms**
- Frontend: Vercel / Netlify / Cloudflare Pages  
  Set `VITE_API_URL` to your API origin.
- Backend: Railway / Render / Fly.io / any Docker host  
  Set `DATABASE_URL` (Postgres) and `FRONTEND_ORIGIN`.

Before real production:
- Add authentication on the verify endpoint
- Rate limiting, input moderation, image upload controls
- Alembic migrations, tests, structured logging
- Privacy policy and attribution compliance

---

## API (selected)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/air-quality` | Current + hourly model data |
| GET | `/api/insights` | Statistical baseline insight |
| GET | `/api/hotspots` | Nearby AQI comparison |
| GET | `/api/geocode` | City search |
| GET | `/api/rights` | International law & climate justice content |
| GET/POST | `/api/reports` | Community observations |
| GET | `/api/community-insights` | Category patterns + suggested action |
| PATCH | `/api/reports/{id}/verify` | Demo-only moderation |

---

## Tech stack

| Layer | Stack |
|-------|--------|
| Backend | FastAPI, SQLAlchemy, Pydantic, httpx |
| Frontend | React 18, Vite, Leaflet, Recharts, Lucide |
| Data | Open-Meteo Air Quality API / CAMS |
| DB | SQLite (local) · PostgreSQL (production) |

---

## Narrative for judges / presentation

1. **Problem** — Air pollution as a mass human-rights and climate-justice failure.  
2. **Legal anchor** — UNGA 76/300 + Paris equity principles.  
3. **Solution** — Transparent model data + community evidence + clear rights framing.  
4. **Demo** — Search any city → map & trends → rights section → submit a report.  
5. **Integrity** — Explicit about model vs sensor data and unverified observations.  
6. **Next** — Auth, trusted sensor networks, policy dashboards, multilingual support.

---

## Attribution

Air-quality data: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) / Copernicus Atmosphere Monitoring Service (CAMS).  
Map tiles: OpenStreetMap contributors.

Check current terms and attribution requirements before public deployment.

---

Built for international hackathons that value substance, equity, and honest technology.
