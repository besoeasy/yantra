export function buildChatGptExplainUrl(appid) {
  const composeUrl = `https://raw.githubusercontent.com/besoeasy/yantra/refs/heads/main/apps/${appid}/compose.yml`;

  const query = `Understand this Yantra Docker stack: ${composeUrl}
(Yantra handles deployment, so skip Docker/installation commands)

Instructions:
- Fetch the compose.yml from the URL (use the raw GitHub URL if needed).
- Understand the project using the compose contents AND the compose labels (especially yantra.* labels).
- If present, treat the yantra.website label as the canonical project/app website.
- Use the internet to fetch/verify up-to-date info (official docs/GitHub) before listing features and alternatives.

Tell me:
1. What does this app do?
2. 5 main features of this app

If you want to know about Yantra : https://github.com/besoeasy/yantra

Make this a well-informed list, keep it short and minimal, and ask if I want to know more.`;

  return `https://chatgpt.com/?q=${encodeURIComponent(query)}`;
}
