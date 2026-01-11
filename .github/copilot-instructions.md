# Project Development Guidelines

## UI Design Standards

### CSS Framework
- **Primary Framework**: Use TailwindCSS for all styling
- **Custom CSS**: Avoid unless absolutely necessary for specific edge cases
- **Rationale**: Maintains consistency and leverages utility-first approach

### User Experience
- **Animations**: Implement smooth transitions and animations throughout the interface
- **Icons**: Use Lucide icons exclusively via `lucide-vue-next` package
- **Design Philosophy**: Follow minimalistic principles prioritizing ease of use
- **Responsiveness**: Ensure all components and pages function properly on mobile devices

---

## Docker App Templates

### Directory Structure
- **Location**: All app templates are stored in `/apps/`
- **Format**: Each app has its Docker Compose configuration at `/apps/<app-name>/compose.yml`

### Critical Rules

#### Atomicity Requirement (MOST IMPORTANT)
**All Docker API actions MUST be atomic** - they must either:
- Fully succeed with all changes applied, OR
- Fully fail with no partial changes

**Reason**: The application is stateless and does not use a database for tracking changes.

#### Implementation Checklist

1. **Conflict Prevention**
   - Run `node check.js` before making changes to detect potential conflicts

2. **Configuration Management**
   - Use environment variables with default values: `${VAR_NAME:-default_value}`
   - **Exception**: Do NOT use environment variables for port mappings
   - Port mappings must be explicit and hardcoded
   - **Port Format**: Use short format `"PORT"` instead of `"PORT:PORT"` for non-essential ports
     - Example: `"25441"` instead of `"25441:25441"`
     - Docker will automatically map to the same port on the host

3. **Storage Guidelines**
   - Use named Docker volumes exclusively
   - **Never** mount directly to host filesystem paths
   - This ensures portability and proper isolation

4. **File Access for User-Facing Folders**
   
   When an app needs to expose folders for user file management (downloads, outputs, uploads, etc.):
   
   - Add a companion service using `sigoden/dufs:latest` (lightweight ~3MB file manager)
   - Mount the shared volume with read-write permissions (not `:ro`)
   - Use the command: `/data --enable-cors --allow-all`
   - Expose the file manager on a separate port from the main app
   - **Reference Example**: See `deluge/compose.yml` for the `deluge-http` service pattern

---

## Required Docker Labels

All Docker Compose apps must include these labels for proper UI integration:

### 1. yantra.name (Required)
- **Purpose**: Human-readable display name
- **Format**: Proper capitalization with spacing
- **Examples**: 
  - `"Pi-hole"`
  - `"Uptime Kuma"`
  - `"Home Assistant"`

### 2. yantra.logo (Required)
- **Purpose**: App logo for visual identification
- **Format**: IPFS CID (Content Identifier)
- **Why IPFS**: Provides reliability and prevents URL-based payloads/tampering
- **Example**: `"QmYSoiyanJ26mbB4CVZXGNEk1tfGjNaEnf3hBQyhtgA85w"`

### 3. yantra.category (Required)
- **Purpose**: Organizes apps into browsable categories
- **Format**: Lowercase only, comma-separated for multiple categories
- **Limit**: Maximum 3 categories per app
- **Best Practice**: Reuse existing categories when possible; create new ones only when necessary
- **Examples**:
  - `"network,security"`
  - `"tools,utility"`
  - `"productivity,security,utility"`

### 4. yantra.port (Optional - Required for Web UIs)
- **Purpose**: Defines primary access port(s) for the app
- **When to Include**: Required if the app has a web interface
- **Format Options**:
  - Single port: `"8080"`
  - Multiple ports with labels: `"8093 (HTTPS - Web UI), 8094 (HTTPS - Admin)"`
- **UI Behavior**: When multiple ports are specified, the UI displays a selection popup

### 5. yantra.description (Required)
- **Purpose**: Brief explanation of app functionality
- **Length**: Under 80 characters
- **Content**: Focus on main purpose and key features
- **Example**: `"Network-wide ad blocking via DNS sinkhole"`

### 6. yantra.website (Required)
- **Purpose**: Link to official resources
- **Preference Order**:
  1. Official documentation
  2. Wiki pages
  3. Project homepage
- **Avoid**: Marketing-focused landing pages when docs are available
- **Example**: `"https://docs.pi-hole.net"`

---

## Post-Edit Checklist

After making any changes to the codebase:
- ✅ Run `node /api/check.js` to verify no conflicts were introduced
- ✅ Test responsive behavior on mobile devices
- ✅ Verify all required labels are present for new apps