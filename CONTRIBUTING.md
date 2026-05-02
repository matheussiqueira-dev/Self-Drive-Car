> Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev

# Contributing to Neural Drive Lab

Thank you for your interest in contributing!

## Project Overview

Neural Drive Lab is a neuroevolution self-driving car simulator built with
vanilla JavaScript and Canvas 2D. An optional Node.js REST backend stores
training run history. The frontend has zero runtime dependencies.

## Architecture

### Frontend

| File | Responsibility |
|---|---|
| `main.js` | AppController, SimulationEngine, loop, UI |
| `car.js` | Car physics, fitness, rendering |
| `controls.js` | Keyboard and AI output mapping |
| `network.js` | NeuralNetwork + Level + clone/mutate |
| `sensor.js` | RaySensor -- ray-casting, intersection |
| `road.js` | Road geometry and lane math |
| `utils.js` | lerp, getIntersection, polysIntersect, getRGBA |
| `visualizer.js` | Static Visualizer that draws the neural network |

### Backend (`backend/`)

```
src/
  config.js        -- env var loading
  index.js         -- entry point, graceful shutdown
  logger.js        -- structured JSON logger
  rateLimiter.js   -- in-memory sliding window
  runRepository.js -- file-backed storage with write lock
  server.js        -- HTTP router, auth, CORS, security headers
  validator.js     -- payload validation (no runtime deps)
tests/
  server.test.js
  rateLimiter.test.js
  runRepository.test.js
  validator.test.js
```

## Local Setup

### Frontend

```bash
# Serve with any static server
npx serve .
# or
python -m http.server 5500
```

Open `http://localhost:5500`.

### Backend

```bash
cd backend
npm install
cp ../.env.example .env   # edit as needed
npm start
```

## Code Standards

- **JavaScript**: ES2022+, no transpilation, no bundler.
- **Backend**: CommonJS modules, `node:test` for tests, no runtime npm deps.
- **Style**: Prettier (config at repo root). Run `npm run fmt` before committing.
- **Lint**: ESLint flat config (`backend/eslint.config.js`). Run `npm run lint`.
- **Tests**: All new backend features must ship with tests in `backend/tests/`.

## Commit Format

```
<type>(<scope>): short description

Optional longer body (wrap at 72 chars).
```

| Type | When |
|---|---|
| `feat` | new capability |
| `fix` | bug fix |
| `perf` | performance improvement |
| `test` | adding or updating tests |
| `chore` | tooling, config, deps |
| `docs` | documentation |
| `refactor` | code change without behaviour change |
| `security` | security improvement |

Scopes: `frontend`, `backend`, or omit for project-wide changes.

## Pull Request Checklist

- [ ] New backend code has tests
- [ ] `npm run ci` passes (lint + fmt + tests) in `backend/`
- [ ] No new runtime npm dependencies added without discussion
- [ ] README updated if user-facing behaviour changed

---

Author: [Matheus Siqueira](https://www.matheussiqueira.dev/)
