import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



function expandPortRange(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return [Number(trimmed)];

    const match = trimmed.match(/^(\d+)-(\d+)$/);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;

    // Avoid accidentally expanding huge ranges.
    if (end - start > 1000) return null;

    const ports = [];
    for (let p = start; p <= end; p++) ports.push(p);
    return ports;
}

function extractPublishedPortsFromComposeObject(composeObj) {
    const publishedPorts = new Set();
    const services = composeObj && typeof composeObj === 'object' ? (composeObj.services || {}) : {};

    for (const [, service] of Object.entries(services)) {
        if (!service || typeof service !== 'object') continue;

        const ports = Array.isArray(service.ports) ? service.ports : [];
        for (const entry of ports) {
            if (typeof entry === 'string') {
                const noProto = entry.split('/')[0].trim();

                let portSpec = noProto;
                const bracketIdx = portSpec.lastIndexOf(']:');
                if (portSpec.startsWith('[') && bracketIdx !== -1) {
                    portSpec = portSpec.slice(bracketIdx + 2);
                }

                const parts = portSpec.split(':').map(p => p.trim()).filter(Boolean);

                // Skip auto-assigned single ports
                if (parts.length < 2) continue;

                let hostPart = null;
                if (parts.length === 2) hostPart = parts[0];
                if (parts.length === 3) hostPart = parts[1];
                if (!hostPart) continue;

                const maybePorts = expandPortRange(hostPart);
                if (maybePorts) {
                    for (const p of maybePorts) publishedPorts.add(p);
                }
            } else if (entry && typeof entry === 'object') {
                const published = entry.published;
                if (typeof published === 'number' && Number.isFinite(published)) {
                    publishedPorts.add(published);
                } else if (typeof published === 'string') {
                    const maybePorts = expandPortRange(published);
                    if (maybePorts) {
                        for (const p of maybePorts) publishedPorts.add(p);
                    }
                }
            }
        }
    }

    return [...publishedPorts].filter(p => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
}



/**
 * Validates info.json structure and required fields.
 */
async function validateInfoJson(appName, infoPath) {
    const errors = [];
    const warnings = [];

    let raw;
    try {
        raw = await readFile(infoPath, 'utf-8');
    } catch {
        errors.push('info.json not found');
        return { errors, warnings };
    }

    let info;
    try {
        info = JSON.parse(raw);
    } catch (e) {
        errors.push(`info.json is not valid JSON: ${e.message}`);
        return { errors, warnings };
    }

    const requiredFields = ['name', 'logo', 'website'];
    for (const field of requiredFields) {
        if (!info[field]) {
            errors.push(`info.json missing required field: "${field}"`);
        }
    }

    // tags must have at least 6 entries
    if (!Array.isArray(info.tags) || info.tags.length < 6) {
        errors.push(`info.json "tags" must have at least 6 tags (found ${info.tags?.length || 0})`);
    } else {
        for (const tag of info.tags) {
            if (typeof tag !== 'string' || tag !== tag.toLowerCase() || !/^[a-z0-9-]+$/.test(tag)) {
                errors.push(`info.json "tags" entry "${tag}" must be lowercase letters, numbers, and hyphens only`);
            }
        }
    }

    // logo should look like an IPFS CID
    if (info.logo) {
        if (info.logo.includes('://')) {
            warnings.push(`info.json "logo" should be an IPFS CID, not a URL: "${info.logo}"`);
        } else if (!/^Qm[a-zA-Z0-9]{44}$/.test(info.logo) && !/^baf[a-zA-Z0-9]+$/.test(info.logo)) {
            warnings.push(`info.json "logo" doesn't look like a valid IPFS CID: "${info.logo}"`);
        }
    }

    // website should be a URL
    if (info.website && !info.website.startsWith('http://') && !info.website.startsWith('https://')) {
        errors.push(`info.json "website" must start with http:// or https://: "${info.website}"`);
    }

    // name should not have leading/trailing whitespace
    if (info.name && info.name !== info.name.trim()) {
        errors.push('info.json "name" has leading/trailing whitespace');
    }

    return { errors, warnings, info };
}

/**
 * Validates that every service in compose.yml has the three required labels:
 * yantr.app, yantr.service, yantr.info
 */
function validateServiceLabels(appName, composeObj) {
    const errors = [];
    const warnings = [];
    const services = composeObj && typeof composeObj === 'object' ? (composeObj.services || {}) : {};

    const requiredLabels = ['yantr.app', 'yantr.service', 'yantr.info'];

    for (const [svcName, service] of Object.entries(services)) {
        if (!service || typeof service !== 'object') continue;

        const raw = service.labels || {};
        const labelMap = {};

        if (Array.isArray(raw)) {
            for (const label of raw) {
                if (typeof label !== 'string') continue;
                const idx = label.indexOf('=');
                if (idx === -1) continue;
                labelMap[label.slice(0, idx).trim()] = label.slice(idx + 1).trim();
            }
        } else {
            Object.assign(labelMap, raw);
        }

        for (const required of requiredLabels) {
            if (!labelMap[required]) {
                errors.push(`Service "${svcName}" is missing required label: ${required}`);
            }
        }

        if (labelMap['yantr.app'] && labelMap['yantr.app'] !== appName) {
            warnings.push(`Service "${svcName}" yantr.app="${labelMap['yantr.app']}" does not match app folder "${appName}"`);
        }
    }

    return { errors, warnings };
}

/**
 * Checks environment variable format — list format is disallowed.
 */
function validateEnvironmentFormat(composeObj) {
    const errors = [];
    const services = composeObj && typeof composeObj === 'object' ? (composeObj.services || {}) : {};

    for (const [svcName, service] of Object.entries(services)) {
        if (!service || typeof service !== 'object') continue;
        const environment = service.environment;

        if (Array.isArray(environment)) {
            errors.push(`Service "${svcName}" uses list format for environment variables. Use key-value format instead (e.g., "VAR: \${VAR:-default}" not "- VAR=\${VAR:-default}")`);
        } else if (environment && typeof environment === 'object') {
            for (const [key, value] of Object.entries(environment)) {
                if (value === null) continue;
                const valueType = typeof value;
                if (valueType !== 'string' && valueType !== 'number') {
                    errors.push(`Service "${svcName}" environment "${key}" has invalid type (${valueType}). Use a string, number, or null.`);
                }
            }
        }
    }

    return errors;
}

function detectUnquotedEnvValues(composeContent) {
    const warnings = [];
    const lines = composeContent.split(/\r?\n/);

    let inServices = false;
    let servicesIndent = null;
    let currentService = null;
    let currentServiceIndent = null;
    let inEnvironment = false;
    let environmentIndent = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#')) continue;

        const indent = line.match(/^\s*/)[0].length;

        if (!inServices) {
            if (trimmed === 'services:') {
                inServices = true;
                servicesIndent = indent;
            }
            continue;
        }

        if (indent <= servicesIndent && trimmed !== 'services:') {
            inServices = false;
            currentService = null;
            inEnvironment = false;
            continue;
        }

        if (indent === servicesIndent + 2 && trimmed.endsWith(':') && !trimmed.startsWith('-')) {
            currentService = trimmed.slice(0, -1).trim();
            currentServiceIndent = indent;
            inEnvironment = false;
            continue;
        }

        if (!currentService) continue;

        if (indent <= currentServiceIndent) {
            currentService = null;
            inEnvironment = false;
            continue;
        }

        if (trimmed === 'environment:' && indent > currentServiceIndent) {
            inEnvironment = true;
            environmentIndent = indent;
            continue;
        }

        if (!inEnvironment) continue;

        if (indent <= environmentIndent) {
            inEnvironment = false;
            continue;
        }

        if (trimmed.startsWith('- ')) {
            continue;
        }

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim();
        let valueRaw = line.slice(colonIdx + 1).trim();

        if (!valueRaw) continue;
        if (valueRaw.startsWith('|') || valueRaw.startsWith('>')) continue;
        if (valueRaw.startsWith('"') || valueRaw.startsWith('\'')) continue;
        if (valueRaw.startsWith('${')) continue;

        // Strip inline comments for unquoted values.
        valueRaw = valueRaw.split(/\s+#/)[0].trim();
        if (!valueRaw) continue;

        if (valueRaw.includes(' ')) {
            warnings.push(
                `Service "${currentService}" environment "${key}" has an unquoted value with spaces. Quote it to avoid YAML parsing issues (line ${i + 1}).`
            );
        }
    }

    return warnings;
}

/**
 * Validates that external networks declared in compose.yml are consistent
 * with the dependencies listed in info.json.
 */
function validateNetworkDependencyConsistency(appName, composeObj, infoDeps) {
    const errors = [];
    const warnings = [];

    if (!composeObj || typeof composeObj !== 'object') return { errors, warnings };

    const deps = Array.isArray(infoDeps) ? infoDeps : [];

    const externalNetworks = [];
    if (composeObj.networks && typeof composeObj.networks === 'object') {
        for (const [netName, netConfig] of Object.entries(composeObj.networks)) {
            if (netConfig?.external === true) {
                externalNetworks.push(netName);
            }
        }
    }

    for (const netName of externalNetworks) {
        if (!netName.endsWith('_network')) continue;
        const expectedDep = netName.replace(/_network$/, '');
        if (!deps.includes(expectedDep)) {
            warnings.push(`Network "${netName}" is external but info.json dependencies does not declare "${expectedDep}"`);
        }
    }

    for (const dep of deps) {
        const expectedNet = `${dep}_network`;
        if (!externalNetworks.includes(expectedNet)) {
            warnings.push(`info.json declares dependency "${dep}" but "${dep}_network" is not declared as an external network`);
        }
    }

    return { errors, warnings };
}

async function detectPortConflict() {
    const appsDir = path.join(__dirname, '..', 'apps');
    const portToFiles = new Map();
    const conflictingPorts = new Set();

    let entries;
    try {
        const fs = await import('fs/promises');
        entries = await fs.readdir(appsDir, { withFileTypes: true });
    } catch {
        return { conflict: false, port: 0 };
    }

    const apps = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    for (const appName of apps) {
        const composePath = path.join(appsDir, appName, 'compose.yml');
        const composePathForOutput = path.relative(__dirname, composePath).replace(/\\/g, '/');
        let composeContent;
        try {
            composeContent = await readFile(composePath, 'utf-8');
        } catch {
            continue;
        }

        let composeObj;
        try {
            composeObj = YAML.parse(composeContent);
        } catch {
            continue;
        }

        const ports = extractPublishedPortsFromComposeObject(composeObj);
        for (const port of ports) {
            const existingFiles = portToFiles.get(port);
            if (existingFiles) {
                existingFiles.add(composePathForOutput);
                conflictingPorts.add(port);
            } else {
                portToFiles.set(port, new Set([composePathForOutput]));
            }
        }
    }

    if (conflictingPorts.size === 0) return { conflict: false, port: 0, files: [] };

    const port = Math.min(...conflictingPorts);
    const files = [...(portToFiles.get(port) || new Set())].sort();
    return { conflict: true, port, files };
}

async function validateAllApps() {
    const appsDir = path.join(__dirname, '..', 'apps');
    const validationResults = [];
    let hasErrors = false;

    let entries;
    try {
        const fs = await import('fs/promises');
        entries = await fs.readdir(appsDir, { withFileTypes: true });
    } catch {
        return { hasErrors: true, results: [{ app: 'system', path: 'N/A', errors: ['Failed to read apps directory'], warnings: [] }] };
    }

    const apps = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    for (const appName of apps) {
        const composePath = path.join(appsDir, appName, 'compose.yml');
        const infoPath = path.join(appsDir, appName, 'info.json');
        const composePathForOutput = path.relative(__dirname, composePath).replace(/\\/g, '/');

        // Validate info.json
        const infoResult = await validateInfoJson(appName, infoPath);
        const infoDeps = Array.isArray(infoResult.info?.dependencies) ? infoResult.info.dependencies : [];

        let composeContent;
        try {
            composeContent = await readFile(composePath, 'utf-8');
        } catch {
            validationResults.push({
                app: appName,
                path: composePathForOutput,
                errors: [...infoResult.errors, 'compose.yml not found'],
                warnings: infoResult.warnings
            });
            hasErrors = true;
            continue;
        }

        let composeObj;
        try {
            composeObj = YAML.parse(composeContent);
        } catch (error) {
            validationResults.push({
                app: appName,
                path: composePathForOutput,
                errors: [...infoResult.errors, `Invalid YAML: ${error.message}`],
                warnings: infoResult.warnings
            });
            hasErrors = true;
            continue;
        }

        const serviceLabelResult = validateServiceLabels(appName, composeObj);
        const networkDepResult = validateNetworkDependencyConsistency(appName, composeObj, infoDeps);
        const envFormatErrors = validateEnvironmentFormat(composeObj);
        const envValueWarnings = detectUnquotedEnvValues(composeContent);

        const errors = [
            ...infoResult.errors,
            ...serviceLabelResult.errors,
            ...networkDepResult.errors,
            ...envFormatErrors
        ];
        const warnings = [
            ...infoResult.warnings,
            ...serviceLabelResult.warnings,
            ...networkDepResult.warnings,
            ...envValueWarnings
        ];

        if (errors.length > 0 || warnings.length > 0) {
            validationResults.push({
                app: appName,
                path: composePathForOutput,
                errors,
                warnings
            });

            if (errors.length > 0) {
                hasErrors = true;
            }
        }
    }

    return { hasErrors, results: validationResults };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    (async () => {
        console.log('🔍 Running Yantr app validation...\n');
        
        // 1. Check port conflicts
        const portResult = await detectPortConflict();
        if (portResult.conflict) {
            console.error('❌ Port conflicts detected!');
            console.error(`Port ${portResult.port} is used by multiple apps:`);
            portResult.files.forEach(file => console.error(`  - ${file}`));
            console.error('');
        } else {
            console.log('✅ No port conflicts found');
        }
        
        // 2. Validate apps
        const appResult = await validateAllApps();
        if (appResult.results.length > 0) {
            console.log('\n📋 App validation results:\n');

            for (const result of appResult.results) {
                console.log(`📦 ${result.app} (${result.path})`);

                if (result.errors.length > 0) {
                    result.errors.forEach(error => console.error(`  ❌ ${error}`));
                }

                if (result.warnings.length > 0) {
                    result.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
                }

                console.log('');
            }
        } else {
            console.log('✅ All apps are valid');
        }
        
        // Exit with error if any issues found
        if (portResult.conflict || appResult.hasErrors) {
            process.exit(1);
        } else {
            console.log('\n✅ All checks passed!');
            process.exit(0);
        }
    })().catch(error => {
        console.error('❌ Error running validation:', error.message);
        process.exit(1);
    });
}

export { detectPortConflict, validateAllApps };
