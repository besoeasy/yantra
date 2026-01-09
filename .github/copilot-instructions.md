# UI Design Guidelines

Ui is located in /ui/

1. Use tailwindcss & aviod custom CSS as much as possible.
2. Use VUEJS framework for all UI components.
3. Follow mobile-first design principles.
4. Use FontAwesome for icons & Avoid using image-based icons.

# Apps

Apps templates located in /apps/, Apps are docker apps which have templates in /apps/<app-name>/compose.yml

All the apps must follow the rules mentioned in apps/guide.md

# GitHub Copilot Instructions

After edits make sure to update index.html if we change anything.

Incase i ask you to add App, make sure to follow the steps below:

## IPFS Upload

To upload images/files to IPFS (for app logos, etc.):

**Example**:

```bash
curl -X POST https://filedrop.besoeasy.com/remoteupload \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/image.png"}'
```

**Response**:

```json
{
  "status": "success",
  "cid": "QmX..."
}
```

Use the returned `cid` value for the `yantra.logo` label in compose files.
