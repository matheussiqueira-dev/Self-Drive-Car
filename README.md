# Neural Drive Lab

Simulador de carro autonomo com neuroevolucao em JavaScript puro, agora com arquitetura evoluida de frontend, painel de treino avancado, historico de geracoes e API backend opcional para persistencia centralizada.

## Visao Geral

O projeto simula uma frota de carros controlados por rede neural aprendendo a dirigir em uma pista com trafego dinamico. A cada frame, sensores por ray-casting alimentam uma rede neural simples e o agente mais adaptado emerge por selecao natural.

### Objetivos de produto

- Demonstrar IA aplicada em tempo real sem dependencias de ML.
- Permitir ajustes de treino e observabilidade da simulacao.
- Oferecer persistencia local e opcionalmente remota.
- Manter uma interface clara, responsiva e acessivel.

## Melhorias Implementadas

### Arquitetura frontend

- `main.js` foi refatorado para separar responsabilidades em camadas:
  - `SafeStorage` para persistencia resiliente.
  - `BrainStore` para salvar, importar e exportar cerebro.
  - `RunApiClient` para integracao remota opcional.
  - `HistoryStore` para historico local/remoto.
  - `SimulationEngine` para regras de negocio da simulacao.
  - `AppController` para orquestracao de UI + loop.
- Configuracoes e limites centralizados.
- Tratamento de erros em operacoes de storage/import/export/sync.

### UX/UI e Design System

- Layout redesenhado com foco em hierarquia visual, legibilidade e densidade de informacao.
- Painel de treino com:
  - presets (`Balanced`, `Fast Learn`, `Dense Traffic`)
  - populacao, trafego, mutacao e quantidade de faixas
  - auto reset por extincao e auto save do melhor cerebro
- Controles de simulacao e atalhos de teclado:
  - `Space` pausar/retomar
  - `R` nova geracao
  - `S` salvar melhor cerebro
- Historico visual de geracoes com distancia, duracao, pico de sobreviventes e motivo.
- Melhor responsividade para desktop/tablet/mobile.
- Melhorias de acessibilidade:
  - labels semanticos
  - estados visuais de foco
  - `aria-live` para metricas dinamicas

### Core de simulacao

- Engine isolada da camada visual.
- Culling basico de trafego fora da viewport para reduzir custo de render.
- Controle de redraw da rede neural em altas velocidades para estabilidade de FPS.
- Correcao de renderizacao de carro danificado em `car.js`.

### Backend opcional (novo)

Foi adicionada uma API REST versionada em `backend/` com:

- `GET /api/v1/health`
- `GET /api/v1/runs?limit=20`
- `POST /api/v1/runs`
- `DELETE /api/v1/runs/:id`

Com foco em producao:

- validacao de payload
- autenticacao por chave (`x-api-key`)
- autorizacao admin para delete (`x-admin-key` opcional)
- rate limiting em memoria
- headers de seguranca
- persistencia em arquivo JSON com lock de escrita
- logging estruturado em JSON

### Qualidade

- Testes adicionados no backend:
  - unitario: validador de payload
  - integracao: criacao + leitura de runs via API

## Regra de SEO/Rastreamento

Nenhuma tag de analytics, pixel, script de rastreamento ou meta de indexacao foi removida/refatorada no HTML.

## Stack e Tecnologias

### Frontend

- HTML5
- CSS3
- JavaScript ES2022+
- Canvas 2D API
- LocalStorage

### Backend opcional

- Node.js (HTTP nativo, sem framework)
- Persistencia em arquivo JSON
- `node:test` para testes

## Estrutura do Projeto

```text
.
├── index.html
├── style.css
├── main.js
├── car.js
├── controls.js
├── network.js
├── road.js
├── sensor.js
├── utils.js
├── visualizer.js
├── backend/
│   ├── package.json
│   ├── data/
│   │   ├── .gitignore
│   │   └── .gitkeep
│   ├── src/
│   │   ├── config.js
│   │   ├── index.js
│   │   ├── logger.js
│   │   ├── rateLimiter.js
│   │   ├── runRepository.js
│   │   ├── server.js
│   │   └── validator.js
│   └── tests/
│       ├── server.test.js
│       └── validator.test.js
└── README.md
```

## Como Executar

### Frontend (simples)

1. Abra `index.html` no navegador.
2. A simulacao inicia automaticamente.

### Frontend (servidor local recomendado)

```bash
# Exemplo com Python
python -m http.server 5500
# abrir http://localhost:5500
```

## Backend Opcional

### Instalar e iniciar

```bash
cd backend
npm install
npm start
```

Servidor padrao: `http://localhost:8787`

### Variaveis de ambiente

- `HOST` (padrao: `0.0.0.0`)
- `PORT` (padrao: `8787`)
- `DATA_FILE` (padrao: `backend/data/runs.json`)
- `API_KEY` (opcional, protege GET/POST)
- `ADMIN_KEY` (opcional, protege DELETE)
- `ALLOWED_ORIGIN` (padrao: `*`)
- `RATE_LIMIT_WINDOW_MS` (padrao: `60000`)
- `RATE_LIMIT_MAX` (padrao: `120`)
- `MAX_BODY_BYTES` (padrao: `65536`)
- `MAX_RUNS` (padrao: `1000`)

### Exemplo de uso da API

```bash
# Health
curl http://localhost:8787/api/v1/health

# Criar run
curl -X POST http://localhost:8787/api/v1/runs \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{
    "generation": 5,
    "bestDistance": 1120,
    "averageFitness": 87.3,
    "alivePeak": 100,
    "durationMs": 38000,
    "reason": "manual",
    "endedAt": "2026-02-09T12:00:00.000Z",
    "config": {
      "population": 100,
      "trafficCount": 50,
      "mutationRate": 0.1,
      "laneCount": 3
    }
  }'

# Listar runs
curl "http://localhost:8787/api/v1/runs?limit=10" -H "x-api-key: SUA_CHAVE"
```

## Testes

Executar testes do backend:

```bash
cd backend
npm test
```

## Deploy

### Frontend

- Pode ser publicado em GitHub Pages, Netlify, Vercel (modo estatico).

### Backend

- Pode ser executado em VPS, Render, Fly.io ou Railway.
- Recomenda-se configurar:
  - `API_KEY` forte
  - `ADMIN_KEY` diferente da `API_KEY`
  - `ALLOWED_ORIGIN` especifico
  - monitoramento de logs

## Boas Praticas Adotadas

- Separacao de responsabilidades (engine, estado, integracao e UI).
- Validacao defensiva de entrada.
- Persistencia resiliente com fallback local.
- Controle de erro e feedback visual ao usuario.
- Headers de seguranca e rate limit na API.
- Testes automatizados para confiabilidade.

## Possiveis Melhorias Futuras

- Persistencia em banco relacional/documento (PostgreSQL/MongoDB).
- Dashboard analitico com comparacao entre configuracoes de treino.
- Replay deterministico de geracoes.
- Telemetria de performance por frame (CPU/GPU timing).
- Modo multiplayer de benchmark entre cerebros.

---

Autoria: Matheus Siqueira  
Website: https://www.matheussiqueira.dev/
