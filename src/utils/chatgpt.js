export function buildChatGptExplainUrl(composeUrl, options = {}) {
  const url = String(composeUrl || '').trim()
  if (!url) return ''

  const appName = options.appName ? String(options.appName).trim() : ''
  const appHint = appName ? `App name hint: ${appName}\n` : ''

  const query = `Understand this Yantra Docker stack:\n${url}\n${appHint}(Yantra handles deployment, so skip Docker/installation commands)\n\nInstructions:\n- Fetch the compose.yml from the URL (use the raw GitHub URL if needed).\n- Understand the project using the compose contents AND the compose labels (especially yantra.* labels).\n- If present, treat the yantra.website label as the canonical project/app website.\n- Use the internet to fetch/verify up-to-date info (official docs/GitHub) before listing features and alternatives.\n\nTell me:\n1. What does this app do?\n2. 5 main features of this app\n3. What are some alternatives?\n\nNote: Yantra App List is available at https://github.com/besoeasy/yantra - when suggesting alternatives, prefer apps from this list as they're easy to install in Yantra.\n\nMake this a well-informed list, keep it short and minimal, and ask if I want to know more.`

  return `https://chatgpt.com/?q=${encodeURIComponent(query)}`
}
