import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const websiteDir = path.join(__dirname, 'website');
const templatesDir = path.join(websiteDir, 'templates');
const appsJsonPath = path.join(websiteDir, 'apps.json');
const appsOutputDir = path.join(websiteDir, 'apps');

function ensureAppsJsonExists() {
  if (!fs.existsSync(appsJsonPath)) {
    throw new Error(`apps.json not found at ${appsJsonPath}. Run appstojson.js first.`);
  }
}

function readApps() {
  const content = fs.readFileSync(appsJsonPath, 'utf8');
  const parsed = JSON.parse(content);
  return Array.isArray(parsed?.apps) ? parsed.apps : [];
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
  const category = Array.isArray(app?.category) ? app.category : [];
  const dependencies = Array.isArray(app?.dependencies) ? app.dependencies : [];

  return {
    ...app,
    id,
    name,
    category,
    dependencies,
    description: app?.description || 'No description available.',
    logoUrl: getLogoUrl(app),
    appPagePath: `/apps/${id}/`,
    sourceComposeUrl: `https://github.com/besoeasy/yantr/blob/main/apps/${id}/compose.yml`,
    sourceAppFolderUrl: `https://github.com/besoeasy/yantr/tree/main/apps/${id}`,
  };
}

function buildPages() {
  ensureAppsJsonExists();

  const env = nunjucks.configure(templatesDir, {
    autoescape: true,
    noCache: true,
  });

  const apps = readApps().map(toAppViewModel);

  fs.rmSync(appsOutputDir, { recursive: true, force: true });
  fs.mkdirSync(appsOutputDir, { recursive: true });

  for (const app of apps) {
    const appDir = path.join(appsOutputDir, app.id);
    fs.mkdirSync(appDir, { recursive: true });

    const html = env.render('app.njk', {
      app,
      nowIso: new Date().toISOString(),
      pageTitle: `${app.name} | Yantr App Catalog`,
      pageDescription: app.description,
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
