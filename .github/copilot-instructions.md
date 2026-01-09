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

If you need something uploaded to IPFS use

curl -X POST http://localhost:3232/remoteupload \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/image.png"}'

  it returns 
  {
  "status": "success",
  "cid": "QmX...",
  }

