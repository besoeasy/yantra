# Yantr Metadata Refactor Plan

## Problem with current approach

- App metadata lives in `compose.yml` labels on the **first service only**
- Multi-service stacks (bitmagnet, perplexica, etc.) have helper containers (postgres, redis) with zero labels — not linked to their app
- Daemon has no way to group multiple containers under one app
- `website-build.js` blindly reads first service, ignores the rest

---

## New file structure per app

```
apps/bitmagnet/
  compose.yml     ← infrastructure only, minimal labels on every service
  info.json       ← app-level metadata (authoritative)
  readme.md       ← optional rich markdown docs
```

---

## `info.json` schema

```json
{
  "name": "Bitmagnet",
  "logo": "QmX2bA23zVjnxGeQgwUfv3XXuascGnnBX33ap7CWWknrXP",
  "category": ["media", "tools", "utility"],
  "port": "3333 (HTTP - Web UI)",
  "short_description": "Self-hosted BitTorrent indexer and DHT crawler.",
  "description": "Bitmagnet is a self-hosted BitTorrent indexer, DHT crawler, content classifier and torrent search engine with web UI, GraphQL API and Servarr stack integration.",
  "usecases": [
    "Index and search torrents from the DHT network",
    "Browse and classify your torrent collection",
    "Integrate with Sonarr, Radarr and other Servarr apps"
  ],
  "website": "https://bitmagnet.io",
  "dependencies": []
}
```

---

## `compose.yml` labels — every service gets only service identity

```yaml
# primary service
labels:
  yantr.app: "bitmagnet"
  yantr.service: "Bitmagnet"
  yantr.info: "Main application server — DHT crawler, HTTP and queue workers"

# helper service
labels:
  yantr.app: "bitmagnet"
  yantr.service: "Bitmagnet Postgres"
  yantr.info: "PostgreSQL database backend"
```

`yantr.app` must match the folder name exactly (used as the lookup key into `info.json`).

---

## Responsibility matrix

| Data | Source | Used by |
|---|---|---|
| name, logo, category, port | `info.json` | daemon catalog, website builder |
| short_description | `info.json` | app cards, catalog list view |
| description | `info.json` | app detail/expanded view |
| usecases | `info.json` | app detail page, feature highlights |
| website, dependencies | `info.json` | daemon catalog, website builder |
| app grouping key | `yantr.app` label | daemon — groups containers by app |
| which deployment instance | `com.docker.compose.project` (auto-set by Docker) | daemon — separates multiple deployments |
| per-container role | `yantr.service` + `yantr.info` labels | daemon UI service rows |
| setup guides, env var docs | `readme.md` | UI docs panel |

---

## Multiple deployments

Docker Compose automatically sets `com.docker.compose.project` on every container.
The daemon groups by `yantr.app` + `com.docker.compose.project` together:

```
App: Bitmagnet  (from info.json)
  └── Deployment: "bitmagnet-prod"
        ├── Bitmagnet          — Main application server
        └── Bitmagnet Postgres — PostgreSQL database backend
  └── Deployment: "bitmagnet-dev"
        ├── Bitmagnet
        └── Bitmagnet Postgres
```

Single-service apps collapse naturally — one deployment, one container, no change in behaviour.

---

## Code changes required

### `website-build.js`
- Remove `extractYantrLabels()` function
- Replace `parseComposeFile()` with `parseInfoJson()` — reads `info.json` directly
- `compose.yml` still read to extract `image` of primary service

### `daemon/main.js` — catalog (`getAppsCatalogCached`)
- Replace regex/label parsing of `compose.yml` with `JSON.parse(info.json)`
- `parseDependenciesFromContent()` removed — dependencies now in `info.json`

### `daemon/main.js` — containers (`GET /api/containers`)
- `parseAppLabels()` simplified to only read `yantr.app`, `yantr.service`, `yantr.info`
- Group containers by `yantr.app` + `com.docker.compose.project`
- Cross-reference `yantr.app` → `info.json` for display metadata

### `apps/` — all compose files
- Strip all `yantr.name`, `yantr.logo`, `yantr.category`, `yantr.port`, `yantr.description`, `yantr.website` labels
- Add `yantr.app`, `yantr.service`, `yantr.info` to **every service** in every compose file
- Create `info.json` for every app (~110 apps)

### `apps/apps.md`
- Update label documentation to reflect new schema

---

## What is NOT changing

- Docker volume strategy
- Port mapping rules
- Compose file naming/structure
- Daemon API endpoint URLs
- How apps are deployed/stopped
