const fs = require('fs');
const path = require('path');

console.log('Starting MotoCare build...');

// Get environment variables
let url = process.env.VITE_SUPABASE_URL || '';
let key = process.env.VITE_SUPABASE_ANON_KEY || '';

// Load local .env if it exists (for local testing if node is available)
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/);
  if (urlMatch && urlMatch[1]) url = urlMatch[1].trim().replace(/['\"`]/g, '');
  if (keyMatch && keyMatch[1]) key = keyMatch[1].trim().replace(/['\"`]/g, '');
}

console.log(`Supabase URL detected: ${url ? 'YES (configured)' : 'NO (empty, fallback to localStorage)'}`);
console.log(`Supabase Anon Key detected: ${key ? 'YES (configured)' : 'NO (empty)'}`);

// Read index.html
if (!fs.existsSync('index.html')) {
  console.error('Error: index.html not found!');
  process.exit(1);
}
let html = fs.readFileSync('index.html', 'utf8');

// Clean up any previous injections to avoid duplicates
const injectionRegex = /<!-- Environment variables injected by build.js -->[\s\S]*?<\/script>/g;
html = html.replace(injectionRegex, '');

// Inject env keys into window
const injection = `<!-- Environment variables injected by build.js -->
  <script>
    window.VITE_SUPABASE_URL = "${url}";
    window.VITE_SUPABASE_ANON_KEY = "${key}";
  </script>`;
html = html.replace('</head>', `${injection}\n</head>`);

// 1. Write back to root index.html (in-place)
fs.writeFileSync('index.html', html);
console.log('Successfully injected env variables into root index.html');

// 2. Also write to dist/index.html (for backward compatibility if Vercel uses dist)
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

console.log('Build completed successfully!');
process.exit(0);
