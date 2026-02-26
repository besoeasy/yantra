#!/usr/bin/env node
// Auto-augment tags for apps with fewer than 6 tags
// Uses description, name, and keyword mapping to suggest additional tags

const fs = require('fs');
const path = require('path');

const appsDir = path.join(__dirname, 'apps');

// Keyword → tag mappings (ordered by specificity)
const KEYWORD_TAGS = [
  // Media & entertainment
  [/\b(video|movie|film|stream|media|watch|subtitle|transcode)\b/i, ['media', 'streaming', 'video']],
  [/\b(music|audio|podcast|radio|song|playlist)\b/i, ['music', 'audio', 'media']],
  [/\b(photo|image|gallery|picture)\b/i, ['photos', 'media', 'gallery']],
  [/\b(book|epub|comic|manga|read)\b/i, ['books', 'media', 'reader']],
  // Download & torrent
  [/\b(torrent|magnet|bittorrent|dht)\b/i, ['torrent', 'download', 'p2p']],
  [/\b(download|downloader|youtube|yt-dlp)\b/i, ['download', 'media', 'utility']],
  // Monitoring & observability
  [/\b(monitor|monitoring|uptime|alert|notif|status|metrics|dashboard)\b/i, ['monitoring', 'dashboard', 'utility']],
  [/\b(log|logging)\b/i, ['monitoring', 'logging', 'utility']],
  // Network & security
  [/\b(vpn|wireguard|openvpn|tunnel)\b/i, ['vpn', 'network', 'security', 'privacy']],
  [/\b(proxy|reverse.proxy|nginx|ingress)\b/i, ['proxy', 'network', 'utility']],
  [/\b(dns|adblock|ad.block|pihole|adguard)\b/i, ['dns', 'network', 'privacy', 'adblock']],
  [/\b(firewall|snort|ids|intrusion)\b/i, ['security', 'network', 'firewall']],
  [/\b(speed.?test|bandwidth|network.?test)\b/i, ['network', 'utility', 'speedtest']],
  [/\b(tor|onion|anonymous|anonymit)\b/i, ['privacy', 'anonymous', 'security', 'tor']],
  // Storage & files
  [/\b(backup|restore|snapshot)\b/i, ['backup', 'storage', 'utility']],
  [/\b(file|folder|storage|s3|object.?store|minio|nas)\b/i, ['storage', 'files', 'utility']],
  [/\b(sync|synchroni)\b/i, ['sync', 'storage', 'utility']],
  [/\b(cloud|nextcloud|self.?host)\b/i, ['cloud', 'self-hosted', 'storage']],
  // Productivity & organization
  [/\b(note|wiki|knowledge|document|docs)\b/i, ['notes', 'wiki', 'productivity']],
  [/\b(todo|task|project.?manag|kanban)\b/i, ['productivity', 'task-manager', 'organizer']],
  [/\b(password|vault|bitwarden|secret)\b/i, ['password-manager', 'security', 'privacy']],
  [/\b(bookmark|link|url)\b/i, ['bookmarks', 'productivity', 'utility']],
  [/\b(calendar|schedule|time.?track|timetrack)\b/i, ['productivity', 'time-tracking', 'calendar']],
  [/\b(invoice|finance|budget|money|account|ledger)\b/i, ['finance', 'accounting', 'self-hosted']],
  [/\b(form|survey)\b/i, ['forms', 'productivity', 'utility']],
  // Development & IT
  [/\b(git|gitlab|gitea|forgejo|code)\b/i, ['git', 'development', 'devops']],
  [/\b(ci|cd|pipeline|deploy|devops)\b/i, ['devops', 'automation', 'development']],
  [/\b(container|docker|kubernetes|k8s|portainer)\b/i, ['docker', 'containers', 'devops']],
  [/\b(database|db|sql|postgres|mysql|mongo)\b/i, ['database', 'storage', 'utility']],
  [/\b(automation|n8n|workflow|webhook)\b/i, ['automation', 'workflow', 'productivity']],
  // Communication & social
  [/\b(chat|message|messenger|matrix|element)\b/i, ['chat', 'messaging', 'communication']],
  [/\b(email|mail|smtp)\b/i, ['email', 'communication', 'utility']],
  [/\b(nostr|relay|social|fediverse)\b/i, ['social', 'nostr', 'decentralized']],
  [/\b(push|notif|gotify|ntfy)\b/i, ['notifications', 'utility', 'self-hosted']],
  // Crypto & blockchain
  [/\b(bitcoin|btc|blockchain|lightning|crypto)\b/i, ['bitcoin', 'crypto', 'blockchain', 'self-hosted']],
  [/\b(wallet|monero|xmr)\b/i, ['crypto', 'wallet', 'privacy', 'self-hosted']],
  [/\b(portfolio|trading|invest)\b/i, ['finance', 'crypto', 'portfolio']],
  // Servarr / media management
  [/\b(sonarr|radarr|prowlarr|bazarr|lidarr|servarr)\b/i, ['servarr', 'automation', 'media']],
  [/\b(indexer|tracker)\b/i, ['indexer', 'servarr', 'automation']],
  // Gaming
  [/\b(minecraft|game|gaming|server)\b/i, ['gaming', 'server', 'self-hosted']],
  // General utility
  [/\b(dashboard|home.?page|start.?page|homer|heimdall)\b/i, ['dashboard', 'utility', 'homepage']],
  [/\b(search|searx|google.?alt)\b/i, ['search', 'privacy', 'utility']],
  [/\b(rss|feed|freshrss|reader)\b/i, ['rss', 'news', 'reader']],
  [/\b(paste|bin|snippet|share)\b/i, ['pastebin', 'utility', 'sharing']],
  [/\b(pdf|convert|doc.?convert)\b/i, ['pdf', 'utility', 'tools']],
  [/\b(terminal|ttyd|web.?terminal|ssh)\b/i, ['terminal', 'utility', 'ssh']],
  [/\b(domain|dns.?monitor|certif|ssl)\b/i, ['domain', 'network', 'monitoring']],
  [/\b(samba|smb|nfs|share)\b/i, ['samba', 'storage', 'network', 'sharing']],
  [/\b(photo.?sync|google.?photo)\b/i, ['photos', 'sync', 'storage']],
];

const UNIVERSAL_TAGS = ['self-hosted', 'homelab', 'docker', 'open-source', 'utility', 'tools', 'server'];

function inferTags(app) {
  const text = `${app.name || ''} ${app.short_description || ''} ${app.description || ''} ${(app.usecases || []).join(' ')}`.toLowerCase();
  const suggested = new Set();

  for (const [regex, tags] of KEYWORD_TAGS) {
    if (regex.test(text)) {
      for (const t of tags) suggested.add(t);
    }
  }

  return [...suggested];
}

const dirs = fs.readdirSync(appsDir).filter((d) => {
  return fs.statSync(path.join(appsDir, d)).isDirectory();
});

let updated = 0;
let skipped = 0;

for (const appId of dirs) {
  const infoPath = path.join(appsDir, appId, 'info.json');
  if (!fs.existsSync(infoPath)) continue;

  let info;
  try {
    info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  } catch (e) {
    console.error(`Error parsing ${appId}/info.json:`, e.message);
    continue;
  }

  if (Array.isArray(info.tags) && info.tags.length >= 6) {
    skipped++;
    continue;
  }

  const existing = new Set(Array.isArray(info.tags) ? info.tags : []);
  const inferred = inferTags(info);

  // Add inferred tags not already present
  for (const t of inferred) {
    if (!existing.has(t)) existing.add(t);
    if (existing.size >= 6) break;
  }

  // If still under 6, fill with universal tags
  if (existing.size < 6) {
    for (const t of UNIVERSAL_TAGS) {
      if (!existing.has(t)) existing.add(t);
      if (existing.size >= 6) break;
    }
  }

  info.tags = [...existing];
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n', 'utf8');
  console.log(`✅ ${appId}: ${info.tags.length} tags → [${info.tags.join(', ')}]`);
  updated++;
}

console.log(`\nupdated: ${updated}  skipped: ${skipped}`);
