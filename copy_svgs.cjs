const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, 'public', 'thumbnails');
const rootDir = __dirname;

const mappings = [
    { key: '单品正面视角', val: 'thumb_a0.svg' },
    { key: '4视角', val: 'thumb_a1.svg' }, // Matches ".../单品3/4视角.svg"
    { key: '俯视60°', val: 'thumb_a2.svg' },
    { key: '副驾侧平视', val: 'thumb_a3.svg' },
    { key: '副驾侧前30°', val: 'thumb_a4.svg' },
    { key: '副驾正侧面', val: 'thumb_a5.svg' },
    { key: '副驾侧含方向盘', val: 'thumb_a6.svg' },
    { key: '俯视后侧50°特写', val: 'thumb_a7.svg' },
    { key: '俯视45°', val: 'thumb_a8.svg' },
    { key: '后排向前视角', val: 'thumb_a9.svg' }
];

function copySvgs(dir) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { return; }

    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const fullPath = path.join(dir, file);

        let stat;
        try { stat = fs.statSync(fullPath); } catch (e) { continue; }

        if (stat.isDirectory()) {
            copySvgs(fullPath);
        } else {
            for (const m of mappings) {
                if (file.includes(m.key) && file.endsWith('.svg')) {
                    const destPath = path.join(destDir, m.val);
                    try {
                        fs.copyFileSync(fullPath, destPath);
                        console.log(`Copied ${file} -> ${m.val}`);
                    } catch (e) {
                        console.error(`Error copying ${file}: ${e.message}`);
                    }
                }
            }
        }
    }
}

console.log("Copying SVGs...");
copySvgs(rootDir);
console.log("Done.");
