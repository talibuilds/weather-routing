# Spotter - Weather-Aware Truck Routing
# Spotter — Weather-Aware Truck Routing

> Intelligent, weather-conscious route optimization and hazard avoidance for commercial trucking and logistics dispatch.
A full-stack React + Django web application that helps truck drivers choose the **safest route** based on real-time weather conditions, load weight, and travel time.

---
![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django) ![Leaflet](https://img.shields.io/badge/Leaflet-Map-199900?logo=leaflet) ![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)

## Overview

**Spotter - Weather-Aware Truck Routing** is an advanced routing and dispatch intelligence platform engineered specifically for freight carriers, commercial truck drivers, and fleet managers. 

Standard GPS routing optimizes solely for distance or standard traffic travel time. Spotter bridges a critical safety and efficiency gap by integrating **real-time highway routing** with **predictive, time-synchronized weather forecasting**. By projecting vehicle position along route options over time, Spotter samples micro-climate forecasts at precise checkpoint ETAs, evaluates cargo-specific risks (such as wind blowover risks based on trailer weight), and recommends the safest, most efficient path.

---

## Architecture Overview
## Features

```
                                      +-------------------------------+
                                      |         React 19 Frontend     |
                                      | (Leaflet Map, Risk Dashboard, |
                                      |   Timeline Scrubber, Inputs)  |
                                      +---------------+---------------+
                                                      |
                                                      | HTTP / REST (JSON)
                                                      v
+-----------------------------------------------------+-----------------------------------------------------+
|                                          Django 5.x Backend API                                           |
|                                                                                                           |
|  +--------------------+    +-----------------------+    +-----------------------+   +-------------------+ |
|  | Geocoding Service  |    | OSRM Routing Service  |    |  Open-Meteo Service   |   |   Risk Engine     | |
|  | (Nominatim/Cache)  |    | (Multi-Route Options) |    | (Time-aligned forecast|   | (Wind x Weight,   | |
|  +--------------------+    +-----------------------+    |  precipitation, ice)  |   |  snow, visibility)| |
|                                                         +-----------------------+   +-------------------+ |
|                                                                                                           |
|                                         +--------------------------------------+                          |
|                                         |     Recommendation & Scoring Engine  |                          |
|                                         |  (Safety vs. Duration Trade-off)     |                          |
|                                         +--------------------------------------+                          |
+-----------------------------------------------------+-----------------------------------------------------+
                                                      |
                                   +------------------+------------------+
                                   |                                     |
                                   v                                     v
                       +-----------------------+             +-----------------------+
                       | OSRM Route Engine API |             |    Open-Meteo API     |
                       | (Road Network & Dist) |             | (Hourly Forecast API) |
                       +-----------------------+             +-----------------------+
```
- **3 Route Alternatives** — Fetches multiple route options from OSRM with full geometry
- **Weather Checkpoint Sampling** — Samples weather every 10/25/50 miles using Open-Meteo forecast API
- **Exact Risk Classification** — Implements wind, rain, snow thresholds + load-weight overrides
- **Smart Route Recommendation** — Multi-criteria ranking: fewest severe miles → fewest high miles → lowest avg risk → shortest time
- **Interactive Dark Map** — Leaflet with colored route polylines, risk-coded checkpoint markers, and origin/destination pins
- **Weather Corridor Heatmap** — 0–48 hour forecast slider with animated auto-play
- **Offline Fallback** — Frontend generates realistic demo data when backend is unavailable
- **Responsive Design** — Works on desktop and tablet

### Key Workflow
1. **Route Generation**: Queries the OSRM routing engine to retrieve up to 3 distinct corridor routes between origin and destination.
2. **Dynamic Checkpoint Sampling**: Samples coordinates along each route geometry at configurable intervals (10, 25, or 50 miles) and calculates cumulative driving times to assign precise forecasted arrival timestamps (ETAs).
3. **Time-Aligned Weather Ingestion**: Batches waypoint coordinates and requests hourly atmospheric forecasts from Open-Meteo corresponding to vehicle ETA at that exact mile-marker.
4. **Load-Aware Risk Assessment**:
   - **Crosswind & Blowover Hazard**: Adjusts wind vulnerability dynamically against trailer load weight (e.g., empty 15,000 lbs trailers face extreme danger at 35+ mph winds, while 80,000 lbs loaded trailers tolerate higher thresholds).
   - **Winter Hazards**: Classifies freezing rain, heavy snowfall accumulation, and black ice risks.
   - **Visibility Hazards**: Flags dense fog, blizzard conditions, and heavy precipitation rates.
5. **Route Recommendation**: Aggregates checkpoint risk indices, peak hazard severity, and total transit duration to formulate a clear, actionable recommendation with full justification.
6. **Corridor Heatmap**: Produces a 0–48 hour forecast time-matrix across the highway corridor to help dispatchers identify optimal departure windows.

---

## Tech Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | React 19, React-Leaflet | Modern, reactive user interface for interactive map visualization and telemetry |
| **Mapping & GIS** | Leaflet 1.9, OpenStreetMap | Interactive tile rendering, color-coded route polylines, custom risk markers |
| **Backend API** | Django 5.x, Django REST Framework | Robust RESTful services, serialization, risk assessment pipelines |
| **Routing Engine** | OSRM (Open Source Routing Machine) | Turn-by-turn road geometry, alternative pathing, highway distance calculations |
| **Weather Provider** | Open-Meteo API | High-resolution, zero-key hourly atmospheric forecast and weather metrics |
| **Styling & Icons** | Tailwind CSS / Lucide React | Clean, high-contrast dashboard with responsive telemetry cards |
| **Database** | SQLite / PostgreSQL | Query logging, audit history, and cached coordinate lookups |
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Leaflet/react-leaflet, Axios, date-fns, Lucide Icons |
| Backend | Django 4.2, Django REST Framework, Python 3.11 |
| Routing | OSRM (Open Source Routing Machine) — free, no API key |
| Weather | Open-Meteo Forecast API — free, no API key |
| Geocoding | Nominatim (OpenStreetMap) — free, no API key |
| Deployment | Render (backend) + Vercel (frontend) |

---
## Risk Rules

## Features
| Condition | Low | Moderate | High | Severe | No Travel |
|-----------|-----|----------|------|--------|-----------|
| Wind | <25 mph | 25–34 | 35–44 | 45–54 | ≥55 mph |
| Rain | <0.10 in/hr | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | >1.00 |
| Snow | <0.5 in/hr | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | >3.0 |

- **3 Alternative Route Comparisons**: Side-by-side inspection of primary and alternate highway corridors with distance, duration, and safety scores.
- **Cargo-Aware Wind Risk**: Dynamic wind hazard calculation scaled by gross vehicle/cargo weight (lbs).
- **Interactive Leaflet Route Map**: Colored route segments and clickable checkpoint pins displaying weather at arrival (Temperature, Wind Gusts, Snow/Rain, Visibility).
- **48-Hour Corridor Weather Heatmap**: Interactive forecast slider scrubbing from $T+0$ to $T+48$ hours.
- **Customizable Sampling Intervals**: Choose between 10-mile, 25-mile, or 50-mile checkpoint resolution.
- **Automated Fallback Mode**: Gracefully handles network and API rate-limits with deterministic simulation fallbacks.
**Load-weight overrides:**
- ≥55 mph wind → No Travel for **any** load
- 45–54 mph wind + >30,000 lb → No Travel
- 35–44 mph wind + >40,000 lb → Severe

---
## Quick Start (Local Development)

## Screenshots Placeholder
### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

```
+---------------------------------------------------------------------------------------------------+
|  [ SPOTTER ]  Weather-Aware Truck Routing                            [ Dispatcher Active | v1.0 ] |
+---------------------------------------------------------------------------------------------------+
|  [ Origin: Chicago, IL ]  [ Dest: Denver, CO ]  [ Departure: 2026-11-23 08:00 ]  [ Weight: 35k ]  |
+----------------------------------------------------+----------------------------------------------+
|                                                    |                                              |
|                  INTERACTIVE MAP                   |           RECOMMENDED ROUTE (#2)             |
|                                                    |  Risk Score: 18/100 (LOW)                    |
|             (Route 1: Via I-80 [High Wind])        |  Duration: 15h 22m   Distance: 1,012 mi      |
|             (Route 2: Via I-70 [RECOMMENDED])      |                                              |
|                                                    |  "Route 2 avoids 48 mph crosswinds on I-80   |
|            [O] ====== [!] ====== [D]               |   through Nebraska. Safest corridor."        |
|                                                    |                                              |
|----------------------------------------------------+----------------------------------------------|
|  WEATHER HEATMAP CORRIDOR SLIDER (0 - 48 Hours)                                                   |
|  [====|================================================================================] Hour +6  |
+---------------------------------------------------------------------------------------------------+
```
*(Add actual UI screenshots in `docs/screenshots/` and link here)*

---

## Prerequisites

- **Python**: 3.10, 3.11, or 3.12
- **Node.js**: 18.x or 20.x LTS
- **npm**: 9.x or later
- **Docker & Docker Compose** *(optional, for containerized deployment)*

---

## Setup & Installation

### Option 1: Quick Start (Windows)

A turnkey Windows batch script is provided at the root:

```cmd
run.bat
```

This launches the Django backend and React frontend in separate windows and automatically opens `http://localhost:3000` in your default browser.

---

### Option 2: Manual Setup

#### 1. Backend Setup (Django)

### Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# (Optional) Run tests to verify the setup
python manage.py test

# Start the Django development server
python manage.py runserver 0.0.0.0:8000
python manage.py runserver 8000
```

The backend API will be accessible at: `http://localhost:8000/api/`

---

#### 2. Frontend Setup (React)

### Frontend Setup
```bash
# Open a new terminal and navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the React development server
npm start
```

The frontend will start at: `http://localhost:3000`
The app opens at **http://localhost:3000** and connects to the Django API at **http://localhost:8000**.

---
## API Endpoints

### Option 3: Docker Compose
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/routes/` | Generate 3 routes with weather, risk, and recommendation |
| POST | `/api/weather-heatmap/` | Get corridor weather grid (0–48hr forecast) |
| GET | `/api/geocode/?q=Chicago` | Geocode a location |
| GET | `/api/health/` | Health check |

You can spin up the full stack using Docker:

```bash
# Build and start both containers
docker-compose up --build

# Run in background (detached mode)
docker-compose up -d

# Stop services
docker-compose down
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

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/`
## Deployment

---
### Backend → Render.com (Free Tier)
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo, set **Root Directory** to `backend`
4. Build Command: `pip install -r requirements.txt && python manage.py migrate`
5. Start Command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
6. Add env var: `DJANGO_SECRET_KEY` = (generate a random key)

## API Documentation
### Frontend → Vercel (Free Tier)
1. Go to [vercel.com](https://vercel.com) → Import Project
2. Connect your GitHub repo, set **Root Directory** to `frontend`
3. Framework Preset: Create React App
4. Add env var: `REACT_APP_API_URL` = `https://your-render-backend-url.onrender.com/api`
5. Deploy

Base URL: `http://localhost:8000/api/`
## Project Structure

### 1. Route Planning & Weather Risk Evaluation
- **Endpoint**: `POST /api/routes/`
- **Description**: Generates 3 route options, evaluates weather at each checkpoint ETA, computes hazard scores, and recommends the safest path.
- **Request Body**:
  ```json
  {
    "origin": "Chicago, IL",
    "destination": "Denver, CO",
    "departure_datetime": "2026-11-23T08:00:00Z",
    "load_weight": 35000,
    "sampling_interval_miles": 25
  }
  ```
- **Response**:
  ```json
  {
    "query": {
      "origin": { "name": "Chicago, IL", "lat": 41.8781, "lng": -87.6298 },
      "destination": { "name": "Denver, CO", "lat": 39.7392, "lng": -104.9903 },
      "departure_datetime": "2026-11-23T08:00:00Z",
      "load_weight_lbs": 35000.0,
      "sampling_interval_miles": 25
    },
    "routes": [
      {
        "id": 0,
        "name": "Route 1 (via I-80 W)",
        "distance_miles": 1004.2,
        "duration_hours": 15.1,
        "risk_summary": {
          "overall_risk_score": 64.5,
          "risk_level": "HIGH",
          "high_risk_checkpoints": 4,
          "moderate_risk_checkpoints": 6
        },
        "checkpoints": [ ... ]
      }
    ],
    "recommendation": {
      "recommended_route_index": 1,
      "justification": "Route 2 offers a 68% risk reduction by avoiding severe 45mph crosswinds on I-80, adding only 18 minutes of travel time."
    }
  }
  ```

---

### 2. Corridor Weather Heatmap
- **Endpoint**: `GET /api/weather-heatmap/` or `POST /api/weather-heatmap/`
- **Query / Payload Parameters**:
  - `origin`: Starting location (e.g., `"Chicago, IL"`)
  - `destination`: Destination location (e.g., `"Denver, CO"`)
  - `load_weight`: Truck gross weight in lbs (e.g., `35000`)
  - `hours`: Forecast projection horizon (default: `48`)
- **Response**:
  Matrix of corridor waypoints with hourly risk scores and weather details across the specified forecast timeline.

---

### 3. Geocode Autocomplete
- **Endpoint**: `GET /api/geocode/?q=<query>`
- **Description**: Geocodes address or city name into latitude/longitude coordinates.
- **Example**: `GET /api/geocode/?q=Salt+Lake+City`

---

### 4. Health Check
- **Endpoint**: `GET /api/health/`
- **Description**: Verification endpoint for system uptime and registered services.
- **Response**:
  ```json
  {
    "status": "healthy",
    "service": "Spotter Weather-Aware Truck Routing Backend",
    "version": "1.0.0"
  }
  ```

---

## Testing

Run backend tests:
```bash
cd backend
python manage.py test
```

Run frontend tests:
```bash
cd frontend
npm test -- --watchAll=false
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

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
MIT
