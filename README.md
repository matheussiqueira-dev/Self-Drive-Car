# Neural Drive Lab

[![CI](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/ci.yml/badge.svg)](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/ci.yml)
[![Deploy](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/deploy.yml/badge.svg)](https://github.com/matheussiqueira-dev/Self-Drive-Car/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green)](backend/package.json)

> Self-driving car simulator powered by neuroevolution -- vanilla JS, Canvas 2D, zero ML dependencies.

![Neural Drive Lab demo](demo.gif)

## Live Demo

**GitHub Pages:** https://matheussiqueira-dev.github.io/Self-Drive-Car/

## Overview

A fleet of cars controlled by small neural networks learns to navigate a road
with dynamic traffic. At every frame, a ray-casting sensor feeds distances to
a fully-connected network; the output maps to forward / left / right / reverse.
Natural selection (fitness = distance - lane-deviation penalty) drives
evolution across generations.

### Architecture

```
Browser
  |
  +-- AppController (main.js)
        |
        +-- SimulationEngine  -- generation loop, traffic, culling
        |     +-- Car[]       -- physics, ray sensors, fitness
        |     |     +-- RaySensor  -- ray-casting intersection
        |     |     +-- NeuralNetwork  -- feedforward + clone + mutate
        |     +-- Road        -- lane geometry, borders
        +-- SafeStorage       -- resilient localStorage wrapper
        +-- BrainStore        -- save / load / import / export
        +-- HistoryStore      -- local + optional remote
        +-- RunApiClient      -- optional backend integration
        +-- Visualizer        -- neural network canvas renderer

Optional Backend (Node.js, no framework)
  +-- HTTP router (server.js)
        +-- RateLimiter       -- in-memory sliding window
        +-- RunRepository     -- JSON file storage, write lock
        +-- Validator         -- payload validation
        +-- Logger            -- structured JSON logs (stdout/stderr)
```

## Stack

| Layer | Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES2022+, Canvas 2D, LocalStorage |
| Backend | Node.js >= 20, HTTP native, JSON file storage |
| Tests | node:test (built-in, no dependencies) |
| CI | GitHub Actions (Node 20 + 22 matrix) |

## Project Structure

```
.
+-- index.html          UI shell and panel
+-- style.css           Design system, responsive layout
+-- main.js             AppController + SimulationEngine
+-- car.js              Car physics, sensor, fitness, rendering
+-- controls.js         Keyboard and AI output mapping
+-- network.js          NeuralNetwork + Level (clone, mutate, feedforward)
+-- sensor.js           RaySensor -- ray-casting
+-- road.js             Road geometry and lane centers
+-- utils.js            lerp, getIntersection, polysIntersect, getRGBA
+-- visualizer.js       Neural network canvas renderer
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

| Key | Action |
|---|---|
| Space | Pause / Resume |
| R | New generation |
| S | Save best brain |

## Quick Start

### Frontend (no install)

```bash
# Python
python -m http.server 5500

# Node
npx serve .
```

Open http://localhost:5500 and press play.

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

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8787` | Listen port |
| `DATA_FILE` | `backend/data/runs.json` | Storage path |
| `API_KEY` | *(empty)* | Protects GET + POST (optional) |
| `ADMIN_KEY` | *(empty)* | Protects DELETE (optional) |
| `ALLOWED_ORIGIN` | `*` | CORS origin |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `RATE_LIMIT_MAX` | `120` | Max requests per window |
| `MAX_BODY_BYTES` | `65536` | Request body cap |
| `MAX_RUNS` | `1000` | Max stored runs |

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
cd backend
npm test               # run all tests (node:test, no deps)
npm run test:coverage  # with coverage report
```

## Security

- API key checks use `crypto.timingSafeEqual` (prevents timing-side-channel).
- Every response includes `X-Request-Id` for end-to-end traceability.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`.
- In-memory rate limiter with periodic store sweep (no unbounded growth).
- Graceful shutdown on SIGTERM/SIGINT for clean container lifecycle.

## Deployment

### Frontend

GitHub Pages, Netlify, Vercel, or any static host.

### Backend

VPS, Render, Fly.io, Railway, or any Node.js host.

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
