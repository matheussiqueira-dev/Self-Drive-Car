> Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev

# Neural Drive Lab

[![CI](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/ci.yml/badge.svg)](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/ci.yml)
[![Deploy](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/deploy.yml/badge.svg)](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green)](backend/package.json)

> Self-driving car simulator powered by neuroevolution, deterministic safety controls, and a professional product shell -- vanilla JS, Canvas 2D, zero ML dependencies.

![Neural Drive Lab demo](demo.gif)

## Live Demo

**Vercel:** https://self-drive-car.vercel.app/

**GitHub Pages:** https://matheussiqueira-dev.github.io/Self-Drive-Car/

## Overview

A fleet of cars controlled by small neural networks learns to navigate a road
with dynamic traffic. At every frame, a 9-ray sensor feeds normalized distances
to a fully-connected network. A deterministic safety layer then removes unsafe
commands, prevents incoherent steering, avoids reverse during autonomous
driving, reacts to critical front obstacles, and keeps the lead car stable
inside the lane.

Natural selection rewards distance, survival, lane discipline, smooth steering,
and successful traffic passing while strongly penalizing collisions, reverse
movement, idle behavior, and unsafe proximity.

### Architecture

```
Browser
  |
  +-- AppController (main.js)
        |
        +-- SimulationEngine  -- generation loop, traffic, culling, elitism
        |     +-- Car[]       -- physics, ray sensors, fitness
        |     |     +-- RaySensor  -- ray-casting intersection
        |     |     +-- DrivingSafety  -- hybrid safety controller
        |     |     +-- NeuralNetwork  -- feedforward + clone + mutate
        |     +-- Road        -- lane geometry, borders
        +-- SafeStorage       -- resilient localStorage wrapper
        +-- BrainStore        -- save / load / import / export
        +-- HistoryStore      -- local + optional remote
        +-- RunApiClient      -- optional backend integration
        +-- Analytics         -- Vercel/GA-ready event adapter
        +-- PWA runtime       -- manifest + service worker registration
        +-- Visualizer        -- neural network canvas renderer

Optional Backend (Node.js, no framework)
  +-- HTTP router (server.js)
        +-- RateLimiter       -- in-memory sliding window
        +-- RunRepository     -- JSON file storage, write lock
        +-- Validator         -- payload validation
        +-- Logger            -- structured JSON logs (stdout/stderr)
```

## Stack

| Layer    | Technologies                                                  |
| -------- | ------------------------------------------------------------- |
| Frontend | HTML5, CSS3, JavaScript ES2022+, Canvas 2D, LocalStorage, PWA |
| Backend  | Node.js >= 20, HTTP native, JSON file storage                 |
| Tests    | node:test for frontend simulation logic and backend API       |
| Deploy   | Vercel static output (`dist/`) and GitHub Pages               |
| CI       | Static build + backend quality gate on Node 20 + 22           |

## Product Features

- Hybrid autonomous driving: neural network intent + deterministic safety layer.
- Professional simulation dashboard with KPIs, risk status, generation history,
  best fitness, collisions, average alive time, and training presets.
- Progressive traffic generation with safe initial spacing and realistic gaps.
- PWA support with manifest, install metadata, offline fallback, and service worker.
- SEO package: canonical URL, Open Graph, Twitter Card, robots.txt, sitemap.xml,
  and SoftwareApplication structured data.
- Analytics-ready architecture for Vercel Analytics, Google Analytics, and custom
  event tracking without requiring secrets for the static simulator.
- Permanent professional credits:
  [Desenvolvido por Matheus Siqueira](https://www.matheussiqueira.dev/).

## Project Structure

```
.
+-- index.html          UI shell and panel
+-- style.css           Design system, responsive layout
+-- main.js             AppController + SimulationEngine
+-- car.js              Car physics, sensor, fitness, rendering
+-- controls.js         Keyboard and AI output mapping
+-- drivingSafety.js    Hybrid safety layer for AI decisions
+-- network.js          NeuralNetwork + Level (clone, mutate, feedforward)
+-- sensor.js           RaySensor -- ray-casting
+-- road.js             Road geometry and lane centers
+-- utils.js            lerp, getIntersection, polysIntersect, getRGBA
+-- visualizer.js       Neural network canvas renderer
+-- analytics.js        Event adapter for Vercel/GA/custom telemetry
+-- pwa.js              Service worker registration
+-- service-worker.js   Offline cache strategy
+-- manifest.webmanifest
+-- robots.txt
+-- sitemap.xml
+-- scripts/
    +-- build-static-site.js
+-- tests/
    +-- frontend.test.js
+-- metadata.json       Machine-readable project card
+-- backend/
    +-- package.json
    +-- .env.example
    +-- eslint.config.js
    +-- src/
        +-- config.js
        +-- index.js         Entry point, graceful shutdown
        +-- logger.js        Structured JSON logger
        +-- rateLimiter.js   In-memory sliding window
        +-- runRepository.js File-backed storage with write lock
        +-- server.js        HTTP router, auth, CORS, security headers
        +-- validator.js     Payload validation (zero deps)
    +-- tests/
        +-- server.test.js
        +-- rateLimiter.test.js
        +-- runRepository.test.js
        +-- validator.test.js
```

## Keyboard Shortcuts

| Key   | Action          |
| ----- | --------------- |
| Space | Pause / Resume  |
| R     | New generation  |
| S     | Save best brain |

## Quick Start

### Frontend

```bash
npm install
npm run start
```

Open the local URL printed by `serve` and press play.

### Static fallback

```bash
python -m http.server 5500
```

Open http://localhost:5500 and press play.

### Production build

```bash
npm install
npm run build
npm run preview
```

The build command validates required static assets and professional credits,
then writes the deployable site to `dist/`.

## Backend (optional)

The backend persists training run history to a JSON file and exposes a REST API.

### Install and start

```bash
cd backend
npm install
cp ../.env.example .env    # fill in API_KEY and ADMIN_KEY
npm start
```

Default: `http://localhost:8787`

### Environment variables

| Variable               | Default                  | Description                    |
| ---------------------- | ------------------------ | ------------------------------ |
| `HOST`                 | `0.0.0.0`                | Bind address                   |
| `PORT`                 | `8787`                   | Listen port                    |
| `DATA_FILE`            | `backend/data/runs.json` | Storage path                   |
| `API_KEY`              | _(empty)_                | Protects GET + POST (optional) |
| `ADMIN_KEY`            | _(empty)_                | Protects DELETE (optional)     |
| `ALLOWED_ORIGIN`       | `*`                      | CORS origin                    |
| `RATE_LIMIT_WINDOW_MS` | `60000`                  | Rate-limit window              |
| `RATE_LIMIT_MAX`       | `120`                    | Max requests per window        |
| `MAX_BODY_BYTES`       | `65536`                  | Request body cap               |
| `MAX_RUNS`             | `1000`                   | Max stored runs                |

### API endpoints

```
GET    /api/v1/health          -- server status (no auth)
GET    /api/v1/runs?limit=20   -- list runs (API_KEY)
POST   /api/v1/runs            -- create run (API_KEY)
DELETE /api/v1/runs/:id        -- delete run (ADMIN_KEY)
```

### cURL examples

```bash
# Health
curl http://localhost:8787/api/v1/health

# Create a run
curl -X POST http://localhost:8787/api/v1/runs   -H "Content-Type: application/json"   -H "x-api-key: YOUR_KEY"   -d '{
    "generation": 5,
    "bestDistance": 1120,
    "averageFitness": 87.3,
    "alivePeak": 100,
    "durationMs": 38000,
    "reason": "manual",
    "endedAt": "2026-04-10T12:00:00.000Z",
    "config": { "population": 100, "trafficCount": 50, "mutationRate": 0.1, "laneCount": 3 }
  }'

# List
curl "http://localhost:8787/api/v1/runs?limit=10" -H "x-api-key: YOUR_KEY"
```

## Makefile cheatsheet

```bash
make backend-install   # npm install in backend/
make backend-start     # start the backend server
make backend-test      # run all backend tests
make backend-lint      # run ESLint
make backend-fmt       # run Prettier
make backend-ci        # lint + fmt-check + test
make help              # print all targets
```

## Tests

```bash
npm test               # frontend simulation tests + backend tests
npm run verify         # build + frontend tests + backend CI
npm run test:coverage  # backend coverage report
```

Frontend tests cover polygon intersection, collision detection, sensor readings
against traffic and road borders, safe traffic generation, neural-network
clone/mutation behavior, safety-layer command sanitization, and elite brain
preservation.

## PWA, SEO and Observability

- `manifest.webmanifest` defines installable app metadata and icons.
- `service-worker.js` caches the static shell and serves `offline.html` as a
  graceful fallback.
- `robots.txt`, `sitemap.xml`, canonical URL, social cards, and JSON-LD metadata
  are included in the static build.
- `analytics.js` exposes `window.AppTelemetry.track(...)` and automatically
  forwards events to Vercel Analytics (`window.va`) or Google Analytics
  (`window.gtag`) when either tool is installed.
- The frontend does not require environment variables. The optional backend can
  be enabled later through `window.NDL_CONFIG.apiBaseUrl` and API keys.

## Security

- API key checks use `crypto.timingSafeEqual` (prevents timing-side-channel).
- Every response includes `X-Request-Id` for end-to-end traceability.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`.
- In-memory rate limiter with periodic store sweep (no unbounded growth).
- Graceful shutdown on SIGTERM/SIGINT for clean container lifecycle.

## Deployment

### Frontend on Vercel

The project includes `vercel.json` for a production static deployment:

- Framework preset: `Other` (`framework: null`)
- Build command: `npm run build`
- Output directory: `dist`
- Security headers: CSP, frame protection, content-type hardening, referrer policy

Deploy with Git integration or the CLI:

```bash
npm run ci
npx vercel deploy --prod --project self-drive-car
```

### Backend

VPS, Render, Fly.io, Railway, or any Node.js host.

The optional API uses local JSON file storage, which is appropriate for a
persistent Node.js host. For Vercel Functions, replace `RunRepository` with a
durable store such as Vercel Blob, Postgres, Redis, or another managed database
before treating remote run history as production-persistent.

Production checklist:

- Set strong, unique `API_KEY` and `ADMIN_KEY`
- Set `ALLOWED_ORIGIN` to your frontend domain
- Mount `DATA_FILE` on persistent storage
- Monitor structured JSON logs (stdout / stderr)

## Author

**Matheus Siqueira**
[matheussiqueira.dev](https://www.matheussiqueira.dev/)

---

License: [MIT](LICENSE)
