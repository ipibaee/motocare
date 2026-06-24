const fs = require('fs');
const path = require('path');

console.log('Starting MotoCare build...');
console.log('Backend: Neon PostgreSQL via /api endpoints');

// Read index.html
if (!fs.existsSync('index.html')) {
  console.error('Error: index.html not found!');
  process.exit(1);
}
let html = fs.readFileSync('index.html', 'utf8');

// Clean up any old Supabase env injection from previous builds (no-op if already clean)
const injectionRegex = /<!-- Environment variables injected by build\.js -->[\s\S]*?<\/script>/g;
html = html.replace(injectionRegex, '<!-- MotoCare API Backend Active - Neon PostgreSQL -->');

// 1. Write back to root index.html (in-place)
fs.writeFileSync('index.html', html);
console.log('Root index.html is ready.');

// 2. Also write to dist/index.html (for Vercel deployment)
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}
fs.writeFileSync(path.join('dist', 'index.html'), html);

// Copy lib directory if it exists
if (fs.existsSync('lib')) {
  const distLibDir = path.join('dist', 'lib');
  if (!fs.existsSync(distLibDir)) {
    fs.mkdirSync(distLibDir);
  }
  fs.readdirSync('lib').forEach(file => {
    fs.copyFileSync(path.join('lib', file), path.join(distLibDir, file));
  });
  console.log('Successfully copied lib assets to dist/lib');
}

// Copy icon assets
const iconFiles = [
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon.ico',
  'site.webmanifest'
];
iconFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('dist', file));
  }
});
console.log('Copied PWA icon assets to dist/');

console.log('Build completed successfully!');
process.exit(0);
