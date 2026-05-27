# XCP-Indexer

A lightweight block explorer / indexer for a local Counterparty (XCP) chain.
Connects to an existing `counterparty-server` running on `localhost:4000`.

## What it does

- Polls the XCP node every 30s and indexes blocks, transactions, issuances, and assets into SQLite
- On first run, backfills the last 100 blocks automatically
- Exposes a REST API on `:3002`
- Serves a React frontend on `:3003`

## Stack

| Layer | Tech |
|---|---|
| Indexer | Node.js + Express |
| DB | SQLite (better-sqlite3) — single file, zero config |
| Frontend | React (CRA) |
| Container | Docker Compose |

## Quick start (local, no Docker)

```bash
# Backend
cd backend
npm install
XCP_URL=http://localhost:4000 node index.js

# Frontend (new terminal)
cd frontend
npm install
REACT_APP_API_URL=http://localhost:3002/api npm start
```

## Docker (recommended)

The docker-compose joins the `counterinscriptions_default` network so the
backend can reach `counterparty-server:4000` by container name.

```bash
# Make sure counterinscriptions stack is running first
docker compose -f ../counterinscriptions/docker-compose.yml up -d

# Then start the indexer
mkdir -p data
docker compose up --build -d
```

Frontend → http://localhost:3003  
API      → http://localhost:3002/api

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/status | Indexer status + stats |
| GET | /api/blocks | Paginated blocks |
| GET | /api/blocks/:n | Block detail + issuances |
| GET | /api/issuances | Paginated issuances (filter: inscription=true/false) |
| GET | /api/assets | Paginated assets (filter: inscription, search) |
| GET | /api/assets/:asset | Asset detail + history |
| GET | /api/address/:addr | Address summary |
| GET | /api/transactions | Paginated transactions |
| GET | /api/search?q= | Search block/tx/asset/address |
| POST | /api/reindex | Wipe state and re-index from scratch |

## Configuration

| Env var | Default | Description |
|---|---|---|
| XCP_URL | http://localhost:4000 | Counterparty node URL |
| PORT | 3002 | Backend listen port |
| POLL_INTERVAL_MS | 30000 | How often to poll for new blocks |
| DB_PATH | ./indexer.db | SQLite database file path |
