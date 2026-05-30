const fs = require('fs');
const path = require('path');

console.log('Starting MotoCare build...');

// Get environment variables
let url = process.env.VITE_SUPABASE_URL || '';
let key = process.env.VITE_SUPABASE_ANON_KEY || '';

// Load local .env if it exists
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

// Inject env keys into window.env
const injection = `
  <!-- Environment variables injected by build.js -->
  <script>
    window.VITE_SUPABASE_URL = "${url}";
    window.VITE_SUPABASE_ANON_KEY = "${key}";
  </script>
`;
html = html.replace('</head>', `${injection}\n</head>`);

// Ensure dist folder exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Write to dist/index.html
fs.writeFileSync(path.join('dist', 'index.html'), html);

// Copy lib directory if it exists
if (fs.existsSync('lib')) {
  const distLibDir = path.join('dist', 'lib');
  if (!fs.existsSync(distLibDir)) {
    fs.mkdirSync(distLibDir);
  }
  fs.readdirSync('lib').forEach(file => {
    fs.copyFileSync(path.join('lib', file), path.join(distLibDir, file));
    console.log(`Copied: lib/${file} -> dist/lib/${file}`);
  });
}

console.log('Build completed successfully in dist/ directory!');
process.exit(0);
