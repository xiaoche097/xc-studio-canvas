const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, 'public', 'thumbnails');
// Search safely for files since paths might have encoding issues
const rootDir = __dirname;

// Map of partial filename to target filename
const fileMapping = {
    '单品': 'thumb_a0.jpg',
    '单品2': 'thumb_a1.jpg',
    '3366': 'thumb_a2.jpg',
    '3367': 'thumb_a3.jpg',
    '3369': 'thumb_a4.jpg',
    '3370': 'thumb_a5.jpg',
    '3373': 'thumb_a6.jpg',
    '3374': 'thumb_a7.jpg',
    '3375': 'thumb_a8.jpg',
    '3379': 'thumb_a9.jpg'
};

function copyRecursive(dir) {
    let files = [];
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return;
    }

    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;

        const fullPath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) { continue; }

        if (stat.isDirectory()) {
            copyRecursive(fullPath);
        } else {
            // Check if file name matches any key
            for (const [key, target] of Object.entries(fileMapping)) {
                // Determine if key matches (ignore extension in check)
                if (file.includes(key)) {
                    const destPath = path.join(destDir, target);
                    try {
                        fs.copyFileSync(fullPath, destPath);
                        console.log(`Successfully copied ${file} -> ${target}`);
                    } catch (err) {
                        console.error(`Failed to copy ${file}: ${err.message}`);
                    }
                }
            }
        }
    }
}

console.log("Starting thumbnail scan and copy...");
copyRecursive(rootDir);
console.log("Done.");
