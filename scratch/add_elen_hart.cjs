const fs = require('fs');
const path = require('path');

const imgCasualPath = 'C:\\Users\\EDY\\.gemini\\antigravity-ide\\brain\\a82e674d-7b7c-4a9e-a902-d27107200216\\media__1787126451845.jpg';
const imgElegantPath = 'C:\\Users\\EDY\\.gemini\\antigravity-ide\\brain\\a82e674d-7b7c-4a9e-a902-d27107200216\\media__1787126451864.jpg';

const publicDir = path.join(__dirname, '../public');

// Copy casual image
const destCasualJpg = path.join(publicDir, 'official_model_elen_hart_casual.jpg');
const destCasualB64 = path.join(publicDir, 'official_model_elen_hart_casual.base64.txt');
fs.copyFileSync(imgCasualPath, destCasualJpg);
const b64Casual = fs.readFileSync(destCasualJpg).toString('base64');
fs.writeFileSync(destCasualB64, b64Casual, 'utf8');
console.log('Saved ELEN-HART (休闲版) - Base64 len:', b64Casual.length);

// Copy elegant image
const destElegantJpg = path.join(publicDir, 'official_model_elen_hart_elegant.jpg');
const destElegantB64 = path.join(publicDir, 'official_model_elen_hart_elegant.base64.txt');
fs.copyFileSync(imgElegantPath, destElegantJpg);
const b64Elegant = fs.readFileSync(destElegantJpg).toString('base64');
fs.writeFileSync(destElegantB64, b64Elegant, 'utf8');
console.log('Saved ELEN-HART (优雅版) - Base64 len:', b64Elegant.length);

// Read modelLibrary.ts and append new model definitions
const modelLibraryFile = path.join(__dirname, '../Cyzx4/services/modelLibrary.ts');
let content = fs.readFileSync(modelLibraryFile, 'utf8');

// We will add ELEN_HART_CASUAL_BASE64 and ELEN_HART_ELEGANT_BASE64 constants and update OFFICIAL_MODELS array
const casualB64Const = `const ELEN_HART_CASUAL_BASE64 = '${b64Casual}';\n`;
const elegantB64Const = `const ELEN_HART_ELEGANT_BASE64 = '${b64Elegant}';\n`;

const casualModelItem = `  {
    id: 'official-model-elen-hart-casual',
    name: 'ELEN-HART (休闲版)',
    isOfficial: true,
    preview: 'data:image/jpeg;base64,' + ELEN_HART_CASUAL_BASE64,
    base64: ELEN_HART_CASUAL_BASE64,
    mime: 'image/jpeg',
    prompt: OFFICIAL_MODEL_PROMPT,
    createdAt: 1700000000004,
    updatedAt: 1700000000004,
  },`;

const elegantModelItem = `  {
    id: 'official-model-elen-hart-elegant',
    name: 'ELEN-HART (优雅版)',
    isOfficial: true,
    preview: 'data:image/jpeg;base64,' + ELEN_HART_ELEGANT_BASE64,
    base64: ELEN_HART_ELEGANT_BASE64,
    mime: 'image/jpeg',
    prompt: OFFICIAL_MODEL_PROMPT,
    createdAt: 1700000000005,
    updatedAt: 1700000000005,
  },`;

// Find where OFFICIAL_MODELS array ends or add before MIRA model item end
const arrayEndIdx = content.indexOf('];', content.indexOf('export const OFFICIAL_MODELS'));

if (arrayEndIdx !== -1) {
  // Insert before OFFICIAL_MODELS definition: the base64 constants
  const officialModelsIdx = content.indexOf('export const OFFICIAL_MODELS');
  content = content.slice(0, officialModelsIdx) + casualB64Const + elegantB64Const + content.slice(officialModelsIdx);

  // Now find the new arrayEndIdx after inserting constants
  const newArrayEndIdx = content.indexOf('];', content.indexOf('export const OFFICIAL_MODELS'));
  content = content.slice(0, newArrayEndIdx) + casualModelItem + '\n' + elegantModelItem + '\n' + content.slice(newArrayEndIdx);
  
  fs.writeFileSync(modelLibraryFile, content, 'utf8');
  console.log('Successfully updated Cyzx4/services/modelLibrary.ts with ELEN-HART (休闲版) and ELEN-HART (优雅版)!');
} else {
  console.error('Could not find OFFICIAL_MODELS array in modelLibrary.ts');
}
