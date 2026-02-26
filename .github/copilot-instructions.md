# Project Development Guidelines

Use Node.js as runtime environment for all JavaScript and TypeScript code.

Backend is located in the `/daemon/` directory. Follow these guidelines when creating or modifying API endpoints.

## APPS Template Standards

Follow the structure and naming conventions outlined in `apps/apps.md` for all application directories and `compose.yml` files. if you need better understanding feel free to pick 5 random apps from the `apps/` directory and study their structure.

### `info.json` Content Requirements

Every app directory must contain an `info.json` file with the following fields:

- **`name`**: Human-readable display name of the app. Use the official product name with correct capitalisation (e.g. `"Nextcloud"`, `"Pi-hole"`).

- **`logo`**: IPFS CID string pointing to the app's logo image. Must be a valid CIDv0 or CIDv1 hash. Used in the UI to display the app icon.

- **`tags`**: Minimum 6 tags. Tags are the sole classification mechanism — there is no `category` field. All tags must be lowercase, using only letters, numbers, and hyphens. Choose tags that reflect the app's function, stack, and target use case.

- **`short_description`**: 50–100 characters. One concise sentence summarising what the app does. No trailing period required. Will be shown on app cards.

- **`description`**: 200–300 characters. A fuller explanation covering purpose, key features, and target audience. Shown on the app detail page.

- **`usecases`**: Minimum 2 entries. Each usecase should be a concrete, distinct scenario describing how the app is used in practice. Avoid vague or duplicate entries.

- **`ports`**: Array of port objects. Each entry must have `port` (number), `protocol` (e.g. `"HTTP"`, `"TCP"`, `"UDP"`), and `label` (human-readable name, e.g. `"Web UI"`). Do NOT use the old `"port"` string format.

  ```json
  "ports": [
    { "port": 8080, "protocol": "HTTP", "label": "Web UI" },
    { "port": 9090, "protocol": "TCP", "label": "Metrics" }
  ]
  ```

- **`website`**: Official homepage URL of the app. Used to link out from the app detail page. Must be a valid `https://` URL.

- **`dependencies`**: Array of app IDs that must be running for this app to function (e.g. `["postgresql", "redis"]`). Use an empty array `[]` if there are none. These IDs must match the directory names under `apps/`.

- **`notes`**: Optional array of strings. Only include when the app has special configuration, non-obvious setup steps, hardcoded credentials, or important port/networking caveats. Omit entirely if there is nothing noteworthy.

### Docker Compose Port Mapping (IMPORTANT)

**ALWAYS use container-only port format** — do NOT bind to a fixed host port:

```yaml
# ✅ Correct — Docker auto-assigns a random host port
ports:
  - "4096"

# ❌ Wrong — fixed host port prevents multiple instances
ports:
  - "4096:4096"
```

**Reason**: Yantr allows users to run multiple instances of the same app. Binding to a fixed host port would cause a conflict on the second instance. Using the container-only format lets Docker assign a random available host port for each instance automatically.

### Docker Compose Service Labels (REQUIRED)

**Every service** in `compose.yml` must have these three labels:

```yaml
labels:
  yantr.app: "app-id"        # matches the app directory name under apps/
  yantr.service: "Display Name"  # human-readable service name shown in the UI
  yantr.info: "One-line description of what this service does"
```

This applies to **all** services in the file, including bundled databases, caches, and sidecars — not just the primary service.

### Docker Compose Environment Variables

**ALWAYS use key-value format for environment variables** in `compose.yml` files:

```yaml
environment:
  VAR: ${VAR:-default}
  ANOTHER_VAR: ${ANOTHER_VAR:-value}
```

**Do NOT use list format:**
```yaml
# ❌ Avoid this format
environment:
  - VAR=${VAR:-default}
  - ANOTHER_VAR=${ANOTHER_VAR:-value}
```

This maintains consistency across all app configurations and follows modern Docker Compose standards.

## UI Design Standards

Use Full width layouts for all pages unless a specific design requirement dictates otherwise.

### CSS Framework

- **Primary Framework**: Use TailwindCSS for all styling
- **Custom CSS**: Avoid unless absolutely necessary for specific edge cases
- **Rationale**: Maintains consistency and leverages utility-first approach
  Make sure dark mode is supported throughout the application.

### User Experience

- **Animations**: Implement smooth transitions and animations throughout the interface
- **Icons**: Use Lucide icons exclusively via `lucide-vue-next` package
- **Design Philosophy**: Follow minimalistic principles prioritizing ease of use
- **Responsiveness**: Ensure all components and pages function properly on mobile devices

---

#### Atomicity Requirement (MOST IMPORTANT)

**All Docker API actions MUST be atomic** - they must either:

- Fully succeed with all changes applied, OR
- Fully fail with no partial changes

**Reason**: The application is stateless and does not use a database for tracking changes.

## Post-Edit Checklist

After making any changes to the codebase:

- ✅ Verify all required labels are present for new apps
