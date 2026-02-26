import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import { parse } from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const websiteDir = path.join(__dirname, 'website');
const templatesDir = path.join(websiteDir, 'templates');
const appsJsonPath = path.join(websiteDir, 'apps.json');
const appsOutputDir = path.join(websiteDir, 'apps');
const appsDir = path.join(__dirname, 'apps');

function parseAppFolder(appId, appPath) {
  const infoPath = path.join(appPath, 'info.json');
  const composePath = path.join(appPath, 'compose.yml');

  try {
    if (!fs.existsSync(infoPath)) {
      console.warn(`⚠️  No info.json found for ${appId}`);
      return null;
    }

    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

    if (!info.name) {
      console.warn(`⚠️  No name field in info.json for ${appId}`);
      return null;
    }

    // Extract primary service image from compose.yml if available
    let image = null;
    let serviceName = null;
    if (fs.existsSync(composePath)) {
      try {
        const composeData = parse(fs.readFileSync(composePath, 'utf8'));
        if (composeData?.services) {
          serviceName = Object.keys(composeData.services)[0];
          image = composeData.services[serviceName]?.image || null;
        }
      } catch {
        // compose.yml unreadable — skip image
      }
    }

    return {
      id: appId,
      name: info.name,
      logo: info.logo || null,
      tags: Array.isArray(info.tags) ? info.tags : [],
      port: info.port || null,
      short_description: info.short_description || '',
      description: info.description || info.short_description || '',
      usecases: Array.isArray(info.usecases) ? info.usecases : [],
      website: info.website || null,
      dependencies: Array.isArray(info.dependencies) ? info.dependencies : [],
      image,
      serviceName,
    };
  } catch (error) {
    console.error(`❌ Error parsing ${appId}/info.json:`, error.message);
    return null;
  }
}

function buildAppsJson() {
  console.log('🔨 Building apps.json from apps folder...\n');

  if (!fs.existsSync(websiteDir)) {
    fs.mkdirSync(websiteDir, { recursive: true });
    console.log(`✅ Created directory: ${websiteDir}\n`);
  }

  const appDirs = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => name !== 'node_modules');

  const apps = [];
  const stats = {
    total: appDirs.length,
    success: 0,
    skipped: 0,
    failed: 0,
  };

  for (const appId of appDirs.sort()) {
    const appPath = path.join(appsDir, appId);
    const infoPath = path.join(appPath, 'info.json');

    if (!fs.existsSync(infoPath)) {
      console.warn(`⚠️  Skipping ${appId}: info.json not found`);
      stats.skipped++;
      continue;
    }

    const appData = parseAppFolder(appId, appPath);
    if (appData) {
      apps.push(appData);
      console.log(`✅ ${appData.name} (${appId})`);
      stats.success++;
    } else {
      stats.failed++;
    }
  }

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalApps: apps.length,
      tags: [...new Set(apps.flatMap((app) => app.tags))].sort(),
    },
    apps,
  };

  fs.writeFileSync(appsJsonPath, JSON.stringify(output, null, 2), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Total directories: ${stats.total}`);
  console.log(`   ✅ Successfully processed: ${stats.success}`);
  console.log(`   ⚠️  Skipped: ${stats.skipped}`);
  console.log(`   ❌ Failed: ${stats.failed}`);
  console.log('='.repeat(60));
  console.log('\n✨ apps.json generated successfully!');
  console.log(`📁 Output: ${appsJsonPath}`);
  console.log(`📦 Total apps: ${apps.length}`);
  console.log(`🏷️  Tags: ${output.meta.tags.length}`);
}

function getLogoUrl(app) {
  if (!app?.logo) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(app?.name || app?.id || 'App')}&background=random&color=fff&bold=true`;
  }

  return app.logo.startsWith('http') ? app.logo : `https://ipfs.io/ipfs/${app.logo}`;
}

function toAppViewModel(app) {
  const id = app?.id || 'unknown-app';
  const name = app?.name || id;
  const dependencies = Array.isArray(app?.dependencies) ? app.dependencies : [];

  return {
    ...app,
    id,
    name,
    dependencies,
    tags: Array.isArray(app?.tags) ? app.tags : [],
    short_description: app?.short_description || '',
    description: app?.description || app?.short_description || 'No description available.',
    usecases: Array.isArray(app?.usecases) ? app.usecases : [],
    logoUrl: getLogoUrl(app),
    appPagePath: `/apps/${id}/`,
    sourceComposeUrl: `https://github.com/besoeasy/yantr/blob/main/apps/${id}/compose.yml`,
    sourceInfoUrl: `https://github.com/besoeasy/yantr/blob/main/apps/${id}/info.json`,
    sourceAppFolderUrl: `https://github.com/besoeasy/yantr/tree/main/apps/${id}`,
  };
}

function getRelatedApps(app, allApps, count = 3) {
  const others = allApps.filter(
    (a) => a.id !== app.id && a.tags.some((t) => app.tags.includes(t))
  );
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return others.slice(0, count);
}

function buildPages() {
  buildAppsJson();

  const env = nunjucks.configure(templatesDir, {
    autoescape: true,
    noCache: true,
  });

  const content = fs.readFileSync(appsJsonPath, 'utf8');
  const parsed = JSON.parse(content);
  const apps = (Array.isArray(parsed?.apps) ? parsed.apps : []).map(toAppViewModel);

  fs.rmSync(appsOutputDir, { recursive: true, force: true });
  fs.mkdirSync(appsOutputDir, { recursive: true });

  for (const app of apps) {
    const appDir = path.join(appsOutputDir, app.id);
    fs.mkdirSync(appDir, { recursive: true });

    const relatedApps = getRelatedApps(app, apps);

    const html = env.render('app.njk', {
      app,
      relatedApps,
      nowIso: new Date().toISOString(),
      pageTitle: `Self-Host ${app.name} with Docker | Yantr`,
      pageDescription: `Learn how to self-host ${app.name} on your homelab using Docker. ${app.description}${app.description.endsWith('.') ? '' : '.'} Easy one-click setup with Yantr.`,
      pageUrl: `https://yantr.org/apps/${app.id}/`,
      imageUrl: app.logoUrl,
    });

    fs.writeFileSync(path.join(appDir, 'index.html'), html, 'utf8');
  }

  console.log(`✨ Generated ${apps.length} app pages in ${appsOutputDir}`);
}

try {
  buildPages();
} catch (error) {
  console.error('❌ Failed to generate app pages:', error.message);
  process.exit(1);
}
