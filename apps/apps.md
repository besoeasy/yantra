teri# What is APP ?

A app is docker container compose.yml that describes a app.

## App Structure

```
apps/app-name/
  compose.yml   ← Docker infrastructure only
  info.json     ← App metadata (authoritative source of truth)
  readme.md     ← Optional rich docs (setup, tips, env var guide)
```

Rules for app-name:
1. Always lowercase
2. Only alphabets, numbers and `-` allowed

---

## info.json

Every app **must** have an `info.json`. This is the single source of truth for all app metadata — used by both the daemon and the website builder.

```json
{
  "name": "Bitmagnet",
  "logo": "QmX2bA23zVjnxGeQgwUfv3XXuascGnnBX33ap7CWWknrXP",
  "tags": ["torrent", "indexer", "dht", "search", "media", "tools"],
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

### Fields

| Field | Required | Description |
|---|---|---|
| `name` | ✅ | Human-readable display name |
| `logo` | ✅ | IPFS CID for app logo |
| `tags` | ✅ | Array of at least 6 lowercase keyword tags (used for filtering and search) |
| `port` | if web UI | e.g. `"3333 (HTTP - Web UI)"` |
| `short_description` | ✅ | Under 120 chars — shown on app cards |
| `description` | ✅ | Full paragraph — shown on app detail page |
| `usecases` | ✅ | Array of use-case bullet points |
| `website` | ✅ | Homepage or GitHub repo URL |
| `dependencies` | ✅ | Array of app IDs that must be deployed first |


---

## compose.yml Rules

1. **Storage Guidelines**

   - Use named Docker volumes exclusively
   - **Never** mount directly to host filesystem paths

2. **Environment Management**

   - Use environment variables with customisable values: `${VAR_NAME:-default_value}`

3. **Port Mapping**
   - AVOID mapping ports ourselves like `HOST-PORT:CONTAINER-PORT`, just `CONTAINER-PORT` is enough

4. **Dependencies & Networking**

   - Each app must be deployable on its own
   - Standalone apps need no `networks` block
   - For apps that expose a service to dependents, define and own a dedicated network:
     ```yaml
     networks:
       ollama_network:
         name: ollama_network
     ```
   - For apps that depend on another app, join that network as external:
     ```yaml
     networks:
       ollama_network:
         name: ollama_network
         external: true
     ```
   - Do not use `depends_on` across different apps — only within the same compose.yml
   - Declare cross-app dependencies in `info.json` under `dependencies`

## Yantr Labels

Every service in every `compose.yml` **must** have these three labels:

```yaml
labels:
  yantr.app: "bitmagnet"          # Must match the app folder name exactly
  yantr.service: "Bitmagnet"      # Display name for this specific container
  yantr.info: "Main application server — DHT crawler, HTTP and queue workers"
```

For helper services in a multi-service stack:

```yaml
labels:
  yantr.app: "bitmagnet"
  yantr.service: "Bitmagnet Postgres"
  yantr.info: "PostgreSQL database backend"
```

### Label fields

| Label | Required | Description |
|---|---|---|
| `yantr.app` | ✅ | App folder name — links container to `info.json` |
| `yantr.service` | ✅ | Display name for this container in the UI |
| `yantr.info` | ✅ | One-line description of this container's role |
