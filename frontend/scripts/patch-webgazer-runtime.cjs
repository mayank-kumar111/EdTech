const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.join(__dirname, '..', 'node_modules', '@webgazer-ts', 'core', 'dist');
const files = ['webgazer-ts.js', 'webgazer.js', 'webgazer-ts.umd.cjs', 'webgazer-ts.umd.js'];
const solutionPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619';
let patchedFiles = 0;

for (const name of files) {
  const filePath = path.join(packageRoot, name);
  if (!fs.existsSync(filePath)) continue;

  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;
  content = content.replace(/(["']?runtime["']?\s*:\s*)["']tfjs["']/g, (_, prefix) => `${prefix}'mediapipe',solutionPath:'${solutionPath}'`);
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    patchedFiles += 1;
    console.log(`Patched MediaPipe runtime in @webgazer-ts/core/dist/${name}`);
  }
}

if (patchedFiles === 0) {
  console.warn('No known @webgazer-ts/core bundle was patched. Check the installed package bundle format before testing eye tracking.');
}
