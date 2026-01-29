const fs = require('fs');
const path = require('path');

const rootDir = __dirname; // Scan from root to be sure

function scan(dir) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { return; }

    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === '.agent') continue;
        const fullPath = path.join(dir, file);

        // Log if it looks like our target files
        if (file.includes('3366') || file.includes('扶手箱')) {
            console.log(`FOUND CANDIDATE: ${fullPath}`);
        }

        try {
            if (fs.statSync(fullPath).isDirectory()) scan(fullPath);
        } catch (e) { }
    }
}

console.log("Scanning...");
scan(rootDir);
