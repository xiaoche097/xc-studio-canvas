const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outFile = path.join(__dirname, 'file_structure.txt');

let output = '';

function scan(dir) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { return; }

    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const fullPath = path.join(dir, file);

        if (fullPath.includes('缩略图')) {
            output += fullPath + '\n';
        }

        try {
            if (fs.statSync(fullPath).isDirectory()) scan(fullPath);
        } catch (e) { }
    }
}

scan(rootDir);
fs.writeFileSync(outFile, output, 'utf8');
console.log("Structure saved to file_structure.txt");
