const fs = require('fs');
const path = require('path');

const img2Path = 'C:\\Users\\EDY\\.gemini\\antigravity-ide\\brain\\25b48a7d-3255-4604-9c8e-f959d45ef59c\\media__1785305194369.jpg';
const destJpg = path.join(__dirname, '../public/official_model_anna.jpg');
const destB64 = path.join(__dirname, '../public/official_model_anna.base64.txt');

// 1. Copy Image 2 to public/official_model_anna.jpg
fs.copyFileSync(img2Path, destJpg);
console.log('Copied Anna image 2 to public/official_model_anna.jpg');

// 2. Read image & convert to base64
const imageData = fs.readFileSync(destJpg);
const b64Anna = imageData.toString('base64');
fs.writeFileSync(destB64, b64Anna, 'utf8');
console.log('Saved Anna base64 to public/official_model_anna.base64.txt');

// 3. Read Gabi & Clara base64 files if available or from modelLibrary.ts
const gabiB64File = path.join(__dirname, '../public/official_model_2.base64.txt');
const claraB64File = path.join(__dirname, '../public/official_model_clara.base64.txt');

const b64Gabi = fs.existsSync(gabiB64File) ? fs.readFileSync(gabiB64File, 'utf8').trim() : '';
const b64Clara = fs.existsSync(claraB64File) ? fs.readFileSync(claraB64File, 'utf8').trim() : '';

console.log('Anna Base64 Length:', b64Anna.length);
