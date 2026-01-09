const fs = require('fs');
const path = require('path');

async function getAppPorts() {
    const appsDir = path.join(__dirname, 'apps');
    const appPortsMap = {};

    try {
        const entries = await fs.promises.readdir(appsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const appName = entry.name;
                const composePath = path.join(appsDir, appName, 'compose.yml');

                try {
                    await fs.promises.access(composePath);
                    const composeContent = await fs.promises.readFile(composePath, 'utf8');
                    
                    // Extract ports using regex - looking for lines with port mappings
                    // Matches: - "port:port", - "${VAR:-port}:port", etc.
                    const portRegex = /^\s*-\s+["']?(?:\$\{[^}]+\}|\d+)[\s]*:[\s]*\d+(?:\/(?:tcp|udp))?["']?/gm;
                    
                    let ports = [];
                    let match;
                    while ((match = portRegex.exec(composeContent)) !== null) {
                        ports.push(match[0].trim());
                    }

                    if (ports.length > 0) {
                        appPortsMap[appName] = ports;
                    }
                } catch (err) {
                    // Skip if compose.yml doesn't exist
                }
            }
        }

        return appPortsMap;
    } catch (error) {
        console.error('Error reading apps directory:', error);
        return {};
    }
}

// Generate port allocation starting from basePort
async function generatePortAllocation(basePort = 5255) {
    const appPortsMap = await getAppPorts();
    const allocation = {};
    let currentPort = basePort;

    // Sort apps for consistent ordering
    const sortedApps = Object.keys(appPortsMap).sort();

    for (const appName of sortedApps) {
        const ports = appPortsMap[appName];
        const portCount = ports.length;
        
        allocation[appName] = {
            count: portCount,
            ports: [],
            envVars: []
        };

        // Extract port metadata from port strings
        const portMetadata = [];
        for (const portStr of ports) {
            // Try to extract protocol info
            const match = portStr.match(/(\w+)?[:\s]*(\d+)?(\/tcp|\/udp)?/i);
            const protocol = portStr.includes('/udp') ? 'UDP' : portStr.includes('/tcp') ? 'TCP' : '';
            portMetadata.push({
                original: portStr,
                protocol: protocol
            });
        }

        // Allocate ports
        for (let i = 0; i < portCount; i++) {
            const suffix = portCount > 1 ? 
                (portMetadata[i].protocol ? portMetadata[i].protocol : ['WEB', 'API', 'SECONDARY', 'TERTIARY', 'QUATERNARY'][i] || `PORT${i+1}`) 
                : '';
            
            const envVarName = suffix 
                ? `${appName.toUpperCase().replace(/-/g, '_')}_PORT_${suffix}`
                : `${appName.toUpperCase().replace(/-/g, '_')}_PORT`;
            
            allocation[appName].ports.push(currentPort);
            allocation[appName].envVars.push(envVarName);
            currentPort++;
        }
    }

    return { basePort, allocation, nextAvailablePort: currentPort };
}

// Get currently used ports from compose files
async function getUsedPorts() {
    const appPortsMap = await getAppPorts();
    const usedPorts = [];

    for (const [appName, ports] of Object.entries(appPortsMap)) {
        for (const portStr of ports) {
            // Extract the host port (left side of :)
            let hostPort;
            
            const plainPortMatch = portStr.match(/^["']?(\d+):/);
            if (plainPortMatch) {
                hostPort = plainPortMatch[1];
            } else {
                const envPortMatch = portStr.match(/\$\{[^:]+:-(\d+)\}/);
                if (envPortMatch) {
                    hostPort = envPortMatch[1];
                }
            }
            
            if (hostPort) {
                usedPorts.push(`${hostPort}:${appName}`);
            }
        }
    }

    usedPorts.sort((a, b) => {
        const portA = parseInt(a.split(':')[0]);
        const portB = parseInt(b.split(':')[0]);
        return portA - portB;
    });

    return usedPorts;
}


// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === '--allocate' || command === '-a') {
        generatePortAllocation().then(result => {
            console.log('\n📋 Recommended Port Allocation:\n');
            
            const tableData = [];
            for (const [appName, data] of Object.entries(result.allocation)) {
                for (let i = 0; i < data.count; i++) {
                    tableData.push({
                        app: appName,
                        portNum: i + 1,
                        port: data.ports[i],
                        envVar: data.envVars[i]
                    });
                }
            }
            
            console.table(tableData);
            console.log(`\n✓ Total apps: ${Object.keys(result.allocation).length}`);
            console.log(`✓ Total ports allocated: ${tableData.length}`);
            console.log(`✓ Next available port: ${result.nextAvailablePort}`);
        });
    } else {
        getUsedPorts().then(ports => {
            console.log('Currently Used Ports:');
            console.log(ports);
        });
    }
}

module.exports = { getUsedPorts, generatePortAllocation, getAppPorts };
