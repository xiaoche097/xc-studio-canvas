const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/xiaoc/.gemini/antigravity-ide/brain/7884c3c1-2e48-4c98-8fb2-265708cad63c';
const files = {
  // 5 大情绪
  neutral: 'face_3d_neutral_1786188311295.png',
  happy: 'face_3d_happy_1786188371488.png',
  excited: 'face_3d_excited_1786188382550.png',
  sad: 'face_3d_sad_1786188323424.png',
  depressed: 'face_3d_depressed_1786188400179.png',
  // 嘴型与视线
  mouth_pout: 'mouth_pout_1786188558444.png',
  mouth_snicker: 'mouth_snicker_1786188570815.png',
  mouth_open: 'mouth_open_1786188583716.png',
  gaze_up: 'gaze_up_1786188593535.png',
  gaze_left: 'gaze_left_1786188602266.png'
};

let output = '// Auto-generated Base64 3D Face Assets for Emotion, Gaze, and Mouth\n';
for (const [key, filename] of Object.entries(files)) {
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    const base64 = 'data:image/png;base64,' + buffer.toString('base64');
    output += `export const FACE_3D_${key.toUpperCase()} = ${JSON.stringify(base64)};\n`;
  }
}

fs.writeFileSync('c:/Users/xiaoc/Desktop/XC-AI/XcAISTUDIO-main/components/face3dAssets.ts', output);
console.log('Successfully generated complete face3dAssets.ts!');
