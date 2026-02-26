# Project Development Guidelines

Use Node.js as runtime environment for all JavaScript and TypeScript code.

Backend is located in the `/daemon/` directory. Follow these guidelines when creating or modifying API endpoints.

## APPS Template Standards

Follow the structure and naming conventions outlined in `apps/apps.md` for all application directories and `compose.yml` files. if you need better understanding feel free to pick 5 random apps from the `apps/` directory and study their structure.

Each app's `info.json` **must** have a minimum of 6 `tags`. Tags are the sole classification mechanism — there is no `category` field. All tags must be lowercase, using only letters, numbers, and hyphens.

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
