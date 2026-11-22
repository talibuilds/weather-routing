# Spotter — Weather-Aware Truck Routing

A full-stack React + Django web application that helps truck drivers choose the **safest route** based on real-time weather conditions, load weight, and travel time.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django) ![Leaflet](https://img.shields.io/badge/Leaflet-Map-199900?logo=leaflet) ![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)

---

## Features

- **3 Route Alternatives** — Fetches multiple route options from OSRM with full geometry
- **Weather Checkpoint Sampling** — Samples weather every 10/25/50 miles using Open-Meteo forecast API
- **Exact Risk Classification** — Implements wind, rain, snow thresholds + load-weight overrides
- **Smart Route Recommendation** — Multi-criteria ranking: fewest severe miles → fewest high miles → lowest avg risk → shortest time
- **Interactive Dark Map** — Leaflet with colored route polylines, risk-coded checkpoint markers, and origin/destination pins
- **Weather Corridor Heatmap** — 0–48 hour forecast slider with animated auto-play
- **Offline Fallback** — Frontend generates realistic demo data when backend is unavailable
- **Responsive Design** — Works on desktop and tablet

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Leaflet/react-leaflet, Axios, date-fns, Lucide Icons |
| Backend | Django 4.2, Django REST Framework, Python 3.11 |
| Routing | OSRM (Open Source Routing Machine) — free, no API key |
| Weather | Open-Meteo Forecast API — free, no API key |
| Geocoding | Nominatim (OpenStreetMap) — free, no API key |
| Deployment | Render (backend) + Vercel (frontend) |

## Risk Rules

| Condition | Low | Moderate | High | Severe | No Travel |
|-----------|-----|----------|------|--------|-----------|
| Wind | <25 mph | 25–34 | 35–44 | 45–54 | ≥55 mph |
| Rain | <0.10 in/hr | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | >1.00 |
| Snow | <0.5 in/hr | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | >3.0 |

**Load-weight overrides:**
- ≥55 mph wind → No Travel for **any** load
- 45–54 mph wind + >30,000 lb → No Travel
- 35–44 mph wind + >40,000 lb → Severe

## Quick Start (Local Development)

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

The app opens at **http://localhost:3000** and connects to the Django API at **http://localhost:8000**.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/routes/` | Generate 3 routes with weather, risk, and recommendation |
| POST | `/api/weather-heatmap/` | Get corridor weather grid (0–48hr forecast) |
| GET | `/api/geocode/?q=Chicago` | Geocode a location |
| GET | `/api/health/` | Health check |

### Example Request
```json
POST /api/routes/
{
  "origin": "Chicago, IL",
  "destination": "Denver, CO",
  "departure_datetime": "2026-11-23T08:00:00Z",
  "load_weight": 42000,
  "sampling_interval_miles": 25
}
```

## Deployment

### Backend → Render.com (Free Tier)
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo, set **Root Directory** to `backend`
4. Build Command: `pip install -r requirements.txt && python manage.py migrate`
5. Start Command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
6. Add env var: `DJANGO_SECRET_KEY` = (generate a random key)

### Frontend → Vercel (Free Tier)
1. Go to [vercel.com](https://vercel.com) → Import Project
2. Connect your GitHub repo, set **Root Directory** to `frontend`
3. Framework Preset: Create React App
4. Add env var: `REACT_APP_API_URL` = `https://your-render-backend-url.onrender.com/api`
5. Deploy

## Project Structure

```
Spotter-Weather-app/
├── backend/
│   ├── config/            # Django settings, URLs, WSGI
│   ├── routing/
│   │   ├── views.py       # API endpoints
│   │   ├── serializers.py # Request validation
│   │   └── services/
│   │       ├── route_service.py      # OSRM routing + checkpoints
│   │       ├── weather_service.py    # Open-Meteo weather
│   │       ├── risk_calculator.py    # Risk classification rules
│   │       └── recommendation.py     # Multi-criteria ranking
│   ├── requirements.txt
│   └── Procfile
├── frontend/
│   ├── src/
│   │   ├── App.js                    # Main layout
│   │   ├── api/routeApi.js           # API client + offline fallback
│   │   └── components/
│   │       ├── MapView.js            # Leaflet map
│   │       ├── RouteForm.js          # Input form
│   │       ├── RouteCard.js          # Route summary cards
│   │       ├── WeatherTimeline.js    # 0-48hr forecast slider
│   │       ├── CheckpointPopup.js    # Map popup details
│   │       └── RiskBadge.js          # Color-coded badges
│   └── vercel.json
└── README.md
```

## License

MIT
